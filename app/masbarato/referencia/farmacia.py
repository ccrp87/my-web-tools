#!/usr/bin/env python3
"""
Comparador de precios para droguerías colombianas.

Uso:
    python comparador.py --descubrir          # detecta qué sitios exponen API VTEX
    python comparador.py "acetaminofen 500"   # compara precios
    python comparador.py "ibuprofeno" --json  # salida en JSON

Requisitos:
    pip install requests
"""

from __future__ import annotations

import argparse
import concurrent.futures
import threading
import json
import re
import sys
import time
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import requests

# --------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------

# Identifícate. Si alguien revisa sus logs, es mejor que vea un humano
# con un correo de contacto que un bot anónimo.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# El contacto va aquí, no dentro del User-Agent: los WAF de estos sitios
# rechazan cadenas con '@' y paréntesis extras. From es el header estándar.
CONTACTO = "tu-correo@ejemplo.com"

TIMEOUT = 15
CACHE_DIR = Path.home() / ".cache" / "comparador-droguerias"
CACHE_TTL = 60 * 60 * 3  # 3 horas: los precios no cambian cada minuto



# --------------------------------------------------------------------------
# Cookie de Cruz Verde vía navegador
# --------------------------------------------------------------------------
# connect.sid no se obtiene con peticiones sueltas: la crea el JavaScript
# del sitio al cargar. Se abre un navegador headless una vez, se toma la
# cookie y se guarda. requests la reutiliza hasta que caduque.

_LOCK_NAVEGADOR = threading.Lock()
COOKIE_CV = CACHE_DIR / "cruzverde_cookie.json"
COOKIE_TTL = 20 * 60          # ~20 min; la sesión suele durar más


def cookie_guardada() -> Optional[str]:
    try:
        if not COOKIE_CV.exists():
            return None
        d = json.loads(COOKIE_CV.read_text(encoding="utf-8"))
        if time.time() - d.get("ts", 0) > COOKIE_TTL:
            return None
        return d.get("connect_sid")
    except Exception:
        return None


def guardar_cookie(valor: str) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        COOKIE_CV.write_text(
            json.dumps({"connect_sid": valor, "ts": time.time()}),
            encoding="utf-8")
        COOKIE_CV.chmod(0o600)
    except Exception:
        pass


def cookie_con_navegador(verboso: bool = False) -> Optional[str]:
    """
    Abre Chromium headless, carga el sitio y devuelve connect.sid.

    Requiere:  pip install playwright  &&  playwright install chromium
    """
    with _LOCK_NAVEGADOR:
        guardada = cookie_guardada()
        if guardada:
            return guardada

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            if verboso:
                print("  Falta Playwright:\n"
                      "    pip install playwright\n"
                      "    playwright install chromium")
            return None

        try:
            with sync_playwright() as p:
                navegador = p.chromium.launch(headless=True)
                ctx = navegador.new_context(locale="es-CO")
                pagina = ctx.new_page()
                pagina.goto("https://www.cruzverde.com.co/",
                            wait_until="networkidle", timeout=45000)

                valor = None
                for c in ctx.cookies():
                    if c["name"] == "connect.sid":
                        valor = c["value"]
                        break
                navegador.close()

            if valor:
                guardar_cookie(valor)
            elif verboso:
                print("  El navegador cargó el sitio pero no apareció connect.sid.")
            return valor

        except Exception as e:
            if verboso:
                print(f"  Falló el navegador: {type(e).__name__}: {e}")
            return None


# --------------------------------------------------------------------------
# Modelo
# --------------------------------------------------------------------------

@dataclass
class Resultado:
    tienda: str
    nombre: str
    precio: Optional[float]
    disponible: bool
    url: str = ""
    marca: str = ""
    texto_busqueda: str = ""  # todos los campos de texto, en minúsculas

    @property
    def precio_fmt(self) -> str:
        if self.precio is None:
            return "—"
        return f"${self.precio:,.0f}".replace(",", ".")


@dataclass
class RespuestaTienda:
    tienda: str
    resultados: list[Resultado] = field(default_factory=list)
    error: Optional[str] = None


# --------------------------------------------------------------------------
# Adaptadores
# --------------------------------------------------------------------------

class Adaptador:
    """Clase base. Cada tienda implementa buscar()."""

    nombre: str
    base_url: str

    def __init__(self, nombre: str, base_url: str):
        self.nombre = nombre
        self.base_url = base_url.rstrip("/")

    def buscar(self, termino: str, limite: int = 5) -> RespuestaTienda:
        raise NotImplementedError

    def _sesion(self) -> requests.Session:
        s = requests.Session()
        s.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-CO,es;q=0.9",
            "From": CONTACTO,
        })
        return s


class AdaptadorVTEX(Adaptador):
    """
    Muchos retailers colombianos corren sobre VTEX, que expone un catálogo
    público con una ruta estándar. Si funciona, es la vía limpia: JSON
    estructurado, sin parsear HTML.
    """

    RUTA = "/api/catalog_system/pub/products/search"

    def disponible(self) -> bool:
        """Comprueba si este sitio responde al endpoint de VTEX."""
        try:
            r = self._sesion().get(
                f"{self.base_url}{self.RUTA}",
                params={"ft": "agua", "_from": 0, "_to": 1},
                timeout=TIMEOUT,
            )
            return r.status_code in (200, 206) and isinstance(r.json(), list)
        except Exception:
            return False

    @staticmethod
    def _tokenizar(termino: str) -> tuple[str, list[str]]:
        """
        Parte el término en (palabra_para_la_API, filtros_locales).

        Estos sitios tienen un WAF que responde "Scripts are not allowed!"
        ante cualquier espacio en la consulta, así que solo se puede mandar
        UNA palabra. Se elige la más larga por ser la más distintiva
        ("acetaminofen" discrimina mucho más que "500"), y el resto se
        filtra aquí con los datos ya en mano.
        """
        tokens = [t for t in re.split(r"[^\w]+", termino, flags=re.UNICODE) if t]
        if not tokens:
            return termino.strip(), []
        clave = max(tokens, key=len)
        return clave, [t for t in tokens if t != clave]

    def buscar(self, termino: str, limite: int = 5) -> RespuestaTienda:
        resp = RespuestaTienda(tienda=self.nombre)
        clave, filtros = self._tokenizar(termino)

        # Si hay que filtrar en local, se pide un lote más grande.
        tope = 49 if filtros else max(0, limite - 1)

        try:
            r = self._sesion().get(
                f"{self.base_url}{self.RUTA}",
                params={"ft": clave, "_from": 0, "_to": tope},
                timeout=TIMEOUT,
            )

            if r.status_code not in (200, 206):
                detalle = r.text.strip()[:80] or f"HTTP {r.status_code}"
                resp.error = f"HTTP {r.status_code}: {detalle}"
                return resp

            productos = [self._parsear(p) for p in r.json()]

            if filtros:
                coinciden = [
                    p for p in productos
                    if all(f.lower() in p.texto_busqueda for f in filtros)
                ]
                # Si el filtro deja todo fuera, mejor mostrar los sin filtrar
                # que un vacío: el usuario decide si le sirven.
                productos = coinciden or productos

            resp.resultados = productos[:limite]

        except requests.exceptions.Timeout:
            resp.error = "timeout"
        except requests.exceptions.RequestException as e:
            resp.error = f"red: {type(e).__name__}"
        except ValueError:
            resp.error = "devolvió HTML, no JSON (no es VTEX)"

        return resp

    def _parsear(self, prod: dict) -> Resultado:
        precio, disponible = None, False
        try:
            oferta = prod["items"][0]["sellers"][0]["commertialOffer"]
            precio = oferta.get("Price") or oferta.get("ListPrice")
            disponible = oferta.get("AvailableQuantity", 0) > 0
        except (KeyError, IndexError, TypeError):
            pass

        url = prod.get("link") or ""
        if url.startswith("/"):
            url = self.base_url + url

        # El término buscado no siempre está en productName. En Olímpica,
        # "ACETAMINOFEN FORTE MK CAJAX10TABLETAS" no contiene "500", pero
        # su productTitle sí ("ACETAMINOFEN FORTE 500/65MG X10 TAB MK").
        # Filtrar solo por el nombre descartaría el producto correcto.
        blob = " ".join(str(prod.get(c, "") or "") for c in (
            "productName", "productTitle", "linkText", "brand",
            "productReference", "metaTagDescription",
        )).lower()

        return Resultado(
            tienda=self.nombre,
            nombre=prod.get("productName", "?"),
            precio=precio,
            disponible=disponible,
            url=url,
            marca=prod.get("brand", ""),
            texto_busqueda=blob,
        )


class AdaptadorHTML(Adaptador):
    """
    Plantilla para sitios que NO exponen API JSON y toca parsear HTML.

    Para completarlo:
      1. Abre el sitio, busca un producto.
      2. DevTools -> Elements. Identifica el contenedor de cada resultado
         y los selectores de nombre y precio.
      3. Rellena RUTA_BUSQUEDA y los tres selectores de abajo.
      4. pip install beautifulsoup4

    Si el HTML llega vacío pero el navegador sí muestra productos, el sitio
    renderiza con JavaScript: usa Playwright en vez de requests.
    """

    RUTA_BUSQUEDA = ""      # ej: "/buscar?q={termino}"
    SEL_ITEM = ""           # ej: "div.product-card"
    SEL_NOMBRE = ""         # ej: "h3.product-title"
    SEL_PRECIO = ""         # ej: "span.price"

    def buscar(self, termino: str, limite: int = 5) -> RespuestaTienda:
        resp = RespuestaTienda(tienda=self.nombre)
        if not self.RUTA_BUSQUEDA:
            resp.error = "adaptador sin configurar"
            return resp

        try:
            from bs4 import BeautifulSoup
        except ImportError:
            resp.error = "falta beautifulsoup4"
            return resp

        try:
            url = self.base_url + self.RUTA_BUSQUEDA.format(termino=termino)
            r = self._sesion().get(url, timeout=TIMEOUT)
            if r.status_code != 200:
                resp.error = f"HTTP {r.status_code}"
                return resp

            sopa = BeautifulSoup(r.text, "html.parser")
            for item in sopa.select(self.SEL_ITEM)[:limite]:
                nombre_el = item.select_one(self.SEL_NOMBRE)
                precio_el = item.select_one(self.SEL_PRECIO)
                resp.resultados.append(Resultado(
                    tienda=self.nombre,
                    nombre=nombre_el.get_text(strip=True) if nombre_el else "?",
                    precio=limpiar_precio(precio_el.get_text()) if precio_el else None,
                    disponible=True,
                ))
        except requests.exceptions.RequestException as e:
            resp.error = f"red: {type(e).__name__}"
        return resp


class AdaptadorFarmatodo(Adaptador):
    """
    Farmatodo busca con Algolia. El endpoint no requiere los tokens de
    sesión que aparecen en otras peticiones del sitio: basta el término
    y los filtros. Por eso aquí no se guarda ninguna credencial.

    El precio vive en varios campos y hay que elegir bien:
      fullPrice        precio normal
      fullPriceByCity  precio por ciudad (puede diferir del anterior)
      offerPrice       promoción vigente; 0 significa "sin oferta"
      primePrice       requiere membresía Prime -> se ignora, porque no
                       es comparable con el precio de las otras tiendas
    """

    ENDPOINT = ("https://api-search.farmatodo.com/1/indexes/*/queries"
                "?x-algolia-agent=Algolia%20for%20JavaScript%20(4.26.0)%3B%20Browser")
    INDICE = "products-colombia"
    CIUDAD = "BOG"   # cambia según dónde compres; afecta el precio

    FILTROS = "outofstore:false  AND NOT rms_class:SAMPLING"

    def buscar(self, termino: str, limite: int = 5) -> RespuestaTienda:
        resp = RespuestaTienda(tienda=self.nombre)

        params = "&".join([
            f"hitsPerPage={max(limite, 10)}",
            "filters=" + quote(self.FILTROS),
            "page=0",
        ])
        cuerpo = {"requests": [{
            "query": termino,          # Algolia sí acepta varias palabras
            "indexName": self.INDICE,
            "params": params,
        }]}

        try:
            s = self._sesion()
            s.headers["Content-Type"] = "application/json"
            r = s.post(self.ENDPOINT, json=cuerpo, timeout=TIMEOUT)

            if r.status_code != 200:
                detalle = r.text.strip()[:100]
                if r.status_code in (401, 403):
                    detalle += "  (¿faltan headers x-algolia-api-key?)"
                resp.error = f"HTTP {r.status_code}: {detalle}"
                return resp

            datos = r.json()
            hits = (datos.get("results") or [{}])[0].get("hits", [])
            resp.resultados = [self._parsear(h) for h in hits][:limite]

        except requests.exceptions.Timeout:
            resp.error = "timeout"
        except requests.exceptions.RequestException as e:
            resp.error = f"red: {type(e).__name__}"
        except (ValueError, KeyError, IndexError):
            resp.error = "respuesta inesperada"
        return resp

    def _precio(self, h: dict) -> Optional[float]:
        """Precio realmente pagable hoy, en la ciudad configurada."""
        candidatos = []

        # Precio base: el de la ciudad manda sobre el general
        base = h.get("fullPrice")
        for entrada in h.get("fullPriceByCity") or []:
            if entrada.get("cityCode") == self.CIUDAD:
                base = entrada.get("fullPrice", base)
                break
        if base:
            candidatos.append(float(base))

        # Oferta vigente. Ojo: 0 quiere decir "sin oferta", no "gratis".
        oferta = h.get("offerPrice")
        if oferta:
            candidatos.append(float(oferta))

        # primePrice se omite a propósito: exige membresía.
        return min(candidatos) if candidatos else None

    def _parsear(self, h: dict) -> Resultado:
        nombre = (h.get("mediaDescription") or "?").strip().lstrip("*").strip()

        # requirePrescription llega como cadena "true"/"false"
        receta = str(h.get("requirePrescription", "")).lower() == "true"
        if receta:
            nombre += "  [requiere fórmula]"

        return Resultado(
            tienda=self.nombre,
            nombre=nombre,
            precio=self._precio(h),
            disponible=bool(h.get("hasStock")),
            marca=h.get("marca") or "",
            texto_busqueda=" ".join(str(h.get(c, "") or "") for c in (
                "mediaDescription", "marca", "largeDescription", "barcode",
            )).lower(),
        )


class AdaptadorCruzVerde(Adaptador):
    """
    Cruz Verde necesita dos llamadas, igual que hace su propia web:

      1. search-suggestions  -> qué productos coinciden (IDs)
      2. product-summary     -> stock real, precios y slug

    La primera devuelve stock=0 para todo porque el inventario depende
    de la zona; la segunda sí lo reporta bien gracias a inventoryId.

    Trampa del precio, igual que con Prime en Farmatodo:
        price-sale-col   descuento para cualquiera     -> sí
        price-list-col   precio normal                 -> sí
        price-club-col   exige Club Cruz Verde         -> se ignora
    """

    BASE = "https://api.cruzverde.com.co/product-service/products"
    ZONA = "COCV_zona70"   # inventario por zona; cámbialo si compras en otra

    # Sesión de invitado: este endpoint devuelve {"authType": "guest", ...}
    # y con él la cookie connect.sid. Se pide en cada búsqueda, así que
    # nunca caduca y no hace falta configurar nada.
    SESION_URL = "https://api.cruzverde.com.co/customer-service/login"

    # Alternativas en ~/.config/comparador/cruzverde.json si algo cambia:
    #   {"session_url": "..."}      otra URL de sesión
    #   {"connect_sid": "s%3A..."}  cookie copiada a mano (caduca)
    CONFIG = Path.home() / ".config" / "comparador" / "cruzverde.json"

    CAMPOS = ("name", "brand", "stock", "prices", "pum", "pageURL",
              "regulated", "skipPrescription", "homeDelivery", "storePickup")

    def _config(self) -> dict:
        if not self.CONFIG.exists():
            return {}
        try:
            return json.loads(self.CONFIG.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _sesion(self) -> requests.Session:
        ses = super()._sesion()
        # La API comprueba de dónde viene la petición. Sin estos dos
        # headers responde 401 aunque la cookie sea válida.
        ses.headers.update({
            "Origin": "https://www.cruzverde.com.co",
            "Referer": "https://www.cruzverde.com.co/",
        })
        return ses

    def _abrir_sesion(self, ses: requests.Session) -> None:
        """
        Provoca el Set-Cookie de connect.sid, que es lo que el navegador
        obtiene al entrar al sitio. requests.Session la guarda sola.

        Si la config trae una cookie copiada a mano, se usa esa.
        """
        cfg = self._config()

        # 1. La vía limpia: la URL que crea la sesión de invitado. Devuelve
        #    {"authType": "guest", ...} y con ella el Set-Cookie. Se llama
        #    en cada búsqueda, así que nunca caduca.
        url_sesion = cfg.get("session_url") or self.SESION_URL
        if url_sesion:
            # No sé si el sitio la llama por GET o por POST, así que se
            # prueban las dos y nos quedamos con la que entregue cookie.
            for metodo in ("post", "get"):
                try:
                    getattr(ses, metodo)(url_sesion, json={} if metodo == "post" else None,
                                         timeout=TIMEOUT)
                    if "connect.sid" in ses.cookies:
                        return
                except requests.exceptions.RequestException:
                    continue

        # 2. Cookie copiada a mano
        cookie = cfg.get("connect_sid")

        # 3. Último recurso: navegador headless (cacheado entre búsquedas)
        if not cookie:
            cookie = cookie_con_navegador()

        if cookie:
            ses.cookies.set("connect.sid", cookie, domain=".cruzverde.com.co")
            return

        # La cookie la emite el backend, no el sitio en Angular, así que
        # se prueba primero la API. Cualquier respuesta sirve: incluso un
        # 401 suele traer el Set-Cookie que necesitamos.
        for url in ("https://api.cruzverde.com.co/product-service/products/search-suggestions?q=a&limit=1",
                    "https://api.cruzverde.com.co/",
                    "https://www.cruzverde.com.co/"):
            try:
                ses.get(url, timeout=TIMEOUT)
                if "connect.sid" in ses.cookies:
                    return
            except requests.exceptions.RequestException:
                continue

    def buscar(self, termino: str, limite: int = 5) -> RespuestaTienda:
        resp = RespuestaTienda(tienda=self.nombre)
        try:
            ses = self._sesion()
            self._abrir_sesion(ses)

            # Paso 1: IDs que coinciden
            sugerencias = {"q": termino, "limit": max(limite, 10)}
            r = ses.get(f"{self.BASE}/search-suggestions",
                        params=sugerencias, timeout=TIMEOUT)

            # Un 401 suele venir CON un Set-Cookie nuevo, así que lo primero
            # es reintentar tal cual, sin borrar nada. Solo si eso falla se
            # descarta la sesión y se pide otra desde cero.
            if r.status_code == 401:
                r = ses.get(f"{self.BASE}/search-suggestions",
                            params=sugerencias, timeout=TIMEOUT)
            if r.status_code == 401:
                ses.cookies.clear()
                COOKIE_CV.unlink(missing_ok=True)   # cacheada y caducada
                self._abrir_sesion(ses)
                r = ses.get(f"{self.BASE}/search-suggestions",
                            params=sugerencias, timeout=TIMEOUT)

            if r.status_code == 401:
                resp.error = ("sin sesión — instala Playwright "
                              "(pip install playwright && playwright install chromium) "
                              f"o copia connect.sid en {self.CONFIG}")
                return resp
            if r.status_code != 200:
                resp.error = f"HTTP {r.status_code}: {r.text.strip()[:80]}"
                return resp

            sugeridos = (r.json().get("productSuggestions") or {}).get("products", [])
            ids = [p["productId"] for p in sugeridos if p.get("productId")][:max(limite, 10)]
            if not ids:
                return resp

            # Paso 2: datos reales (el orden de relevancia lo da el paso 1)
            r2 = ses.get(f"{self.BASE}/product-summary",
                         params={"ids": ids, "fields": list(self.CAMPOS),
                                 "inventoryId": self.ZONA},
                         timeout=TIMEOUT)
            if r2.status_code != 200:
                resp.error = f"HTTP {r2.status_code} en detalles"
                return resp

            detalles = r2.json()
            resp.resultados = [
                self._parsear(pid, detalles[pid]) for pid in ids if pid in detalles
            ][:limite]

        except requests.exceptions.Timeout:
            resp.error = "timeout"
        except requests.exceptions.RequestException as e:
            resp.error = f"red: {type(e).__name__}"
        except (ValueError, AttributeError, KeyError):
            resp.error = "respuesta inesperada"
        return resp

    def _precio(self, d: dict) -> Optional[float]:
        precios = d.get("prices") or {}
        validos = [float(v) for v in (precios.get("price-sale-col"),
                                      precios.get("price-list-col")) if v]
        return min(validos) if validos else None

    def _parsear(self, pid: str, d: dict) -> Resultado:
        nombre = (d.get("name") or "?").strip()
        if d.get("regulated") and not d.get("skipPrescription"):
            nombre += "  [requiere fórmula]"

        stock = d.get("stock")
        return Resultado(
            tienda=self.nombre,
            nombre=nombre,
            precio=self._precio(d),
            disponible=bool(stock),          # aquí el stock sí es de fiar
            marca=(d.get("brand") or "").title(),
            texto_busqueda=" ".join(str(d.get(c, "") or "") for c in
                                    ("name", "brand", "pum")).lower() + " " + pid.lower(),
        )


def limpiar_precio(texto: str) -> Optional[float]:
    """'$ 12.500,00' -> 12500.0"""
    if not texto:
        return None
    limpio = re.sub(r"[^\d,.]", "", texto)
    # Formato colombiano: punto = miles, coma = decimal
    if "," in limpio:
        limpio = limpio.replace(".", "").replace(",", ".")
    else:
        limpio = limpio.replace(".", "")
    try:
        return float(limpio)
    except ValueError:
        return None


# --------------------------------------------------------------------------
# Registro de tiendas
# --------------------------------------------------------------------------
# Verifica los dominios con --descubrir antes de confiar en ellos.

TIENDAS: list[Adaptador] = [
    AdaptadorVTEX("Olímpica",     "https://www.olimpica.com"),
    AdaptadorFarmatodo("Farmatodo", "https://www.farmatodo.com.co"),
    AdaptadorCruzVerde("Cruz Verde", "https://www.cruzverde.com.co"),
    AdaptadorVTEX("La Rebaja",    "https://www.larebajavirtual.com"),
    AdaptadorVTEX("Dro. Inglesa", "https://www.tudrogueriavirtual.com"),
]


# --------------------------------------------------------------------------
# Caché
# --------------------------------------------------------------------------

def _ruta_cache(clave: str) -> Path:
    seguro = re.sub(r"[^a-z0-9]+", "_", clave.lower())[:80]
    return CACHE_DIR / f"{seguro}.json"


def leer_cache(clave: str) -> Optional[list[dict]]:
    ruta = _ruta_cache(clave)
    if not ruta.exists() or time.time() - ruta.stat().st_mtime > CACHE_TTL:
        return None
    try:
        return json.loads(ruta.read_text(encoding="utf-8"))
    except Exception:
        return None


def guardar_cache(clave: str, datos: list[dict]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        _ruta_cache(clave).write_text(
            json.dumps(datos, ensure_ascii=False), encoding="utf-8"
        )
    except Exception:
        pass


# --------------------------------------------------------------------------
# Búsqueda
# --------------------------------------------------------------------------

def buscar_todas(termino: str, limite: int = 5) -> list[RespuestaTienda]:
    """Una petición por tienda, en paralelo. Carga mínima para cada sitio."""
    respuestas: list[RespuestaTienda] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(TIENDAS)) as pool:
        futuros = {pool.submit(t.buscar, termino, limite): t for t in TIENDAS}
        for f in concurrent.futures.as_completed(futuros):
            try:
                respuestas.append(f.result())
            except Exception as e:
                respuestas.append(
                    RespuestaTienda(tienda=futuros[f].nombre, error=str(e))
                )
    respuestas.sort(key=lambda r: r.tienda)
    return respuestas


# --------------------------------------------------------------------------
# Salida
# --------------------------------------------------------------------------

def imprimir_tabla(respuestas: list[RespuestaTienda], termino: str) -> None:
    todos = [r for resp in respuestas for r in resp.resultados if r.precio]
    disponibles = [r for r in todos if r.disponible]
    mejor = min(disponibles or todos, key=lambda r: r.precio, default=None)

    print(f"\n  Búsqueda: {termino}")
    print("  " + "─" * 74)

    for resp in respuestas:
        if resp.error:
            print(f"  {resp.tienda:<14} ⚠  {resp.error}")
            continue
        if not resp.resultados:
            print(f"  {resp.tienda:<14} sin resultados")
            continue

        print(f"  {resp.tienda}")
        for r in resp.resultados:
            marca = "★" if mejor and r is mejor else " "
            stock = "" if r.disponible else "  (agotado)"
            nombre = r.nombre[:52] + ("…" if len(r.nombre) > 52 else "")
            print(f"   {marca} {r.precio_fmt:>11}  {nombre}{stock}")
        print()

    if mejor:
        print("  " + "─" * 74)
        print(f"  ★ Más barato: {mejor.precio_fmt} en {mejor.tienda}")
        if mejor.url:
            print(f"    {mejor.url}")
    print()


def modo_descubrir() -> None:
    """Comprueba qué sitios responden al endpoint de VTEX."""
    print("\n  Comprobando cada tienda...\n")
    for t in TIENDAS:
        if isinstance(t, AdaptadorVTEX):
            ok = t.disponible()
            estado = "✓ VTEX — funciona" if ok else "✗ no responde — toca inspeccionar"
        elif isinstance(t, AdaptadorFarmatodo):
            estado = "· API Algolia propia"
        elif isinstance(t, AdaptadorCruzVerde):
            estado = "· API REST propia"
        else:
            estado = "· adaptador HTML (sin configurar)"
        print(f"  {t.nombre:<14} {estado}")

    print("""
  Para los que fallen:
    1. Abre el sitio en el navegador y busca un producto.
    2. DevTools (F12) → pestaña Network → filtro XHR/Fetch.
    3. Los JSON que aparezcan son la API real. Copia la URL.
    4. Si no hay JSON, usa AdaptadorHTML con los selectores del DOM.
""")


# --------------------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser(description="Compara precios entre droguerías colombianas.")
    p.add_argument("termino", nargs="?", help="qué buscar")
    p.add_argument("--descubrir", action="store_true", help="detectar qué APIs funcionan")
    p.add_argument("--limite", type=int, default=3, help="resultados por tienda (def. 3)")
    p.add_argument("--json", action="store_true", help="salida en JSON")
    p.add_argument("--sin-cache", action="store_true", help="ignorar caché")
    args = p.parse_args()

    if args.descubrir:
        modo_descubrir()
        return 0

    if not args.termino:
        p.print_help()
        return 1

    clave = f"{args.termino}|{args.limite}"
    if not args.sin_cache and (cacheado := leer_cache(clave)):
        respuestas = [
            RespuestaTienda(
                tienda=d["tienda"],
                error=d.get("error"),
                resultados=[Resultado(**r) for r in d.get("resultados", [])],
            )
            for d in cacheado
        ]
    else:
        respuestas = buscar_todas(args.termino, args.limite)
        guardar_cache(clave, [asdict(r) for r in respuestas])

    if args.json:
        print(json.dumps([asdict(r) for r in respuestas], ensure_ascii=False, indent=2))
    else:
        imprimir_tabla(respuestas, args.termino)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)