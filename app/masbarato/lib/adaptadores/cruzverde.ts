import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador } from "./tipos";
import {
  cabecerasBase,
  describirError,
  esErrorDeTimeout,
  fetchConTimeout,
} from "./http";
import { palabrasSignificativas } from "./tokenizar";

const TIENDA = "Cruz Verde";

const BASE = "https://api.cruzverde.com.co/product-service/products";
const ZONA = "COCV_zona70"; // Inventario por zona; cámbialo si compras en otra.
const ORIGEN = "https://www.cruzverde.com.co";

// Sesión de invitado: este endpoint devuelve {"authType": "guest", ...} y
// con él la cookie connect.sid.
const SESION_URL = "https://api.cruzverde.com.co/customer-service/login";

const CAMPOS = [
  "name",
  "brand",
  "stock",
  "prices",
  "pum",
  "pageURL",
  "regulated",
  "skipPrescription",
  "homeDelivery",
  "storePickup",
];

interface DetalleProductoCruzVerde {
  name?: string;
  brand?: string;
  stock?: number;
  prices?: Record<string, number>;
  pageURL?: string;
  regulated?: boolean;
  skipPrescription?: boolean;
}

function capitalizarTitulo(texto: string): string {
  return texto.replace(
    /\p{L}[\p{L}\d]*/gu,
    (palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase(),
  );
}

function cabecerasCruzVerde(cookie?: string | null): Record<string, string> {
  const cabeceras: Record<string, string> = {
    ...cabecerasBase(),
    Origin: ORIGEN,
    Referer: `${ORIGEN}/`,
  };
  if (cookie) {
    cabeceras.Cookie = `connect.sid=${cookie}`;
  }
  return cabeceras;
}

function extraerCookieConnectSid(respuesta: Response): string | null {
  const headers = respuesta.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const lineas =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter((v): v is string => Boolean(v));

  for (const linea of lineas) {
    const match = /connect\.sid=([^;]+)/.exec(linea);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Provoca el Set-Cookie de connect.sid, que es lo que el navegador obtiene
 * al entrar al sitio. Solo las vías con fetch puro: sin el fallback de
 * navegador headless que usa la versión CLI, porque añadir Playwright a una
 * app web es una dependencia pesada para lo que gana.
 */
async function abrirSesion(): Promise<string | null> {
  for (const metodo of ["POST", "GET"] as const) {
    try {
      const respuesta = await fetchConTimeout(SESION_URL, {
        method: metodo,
        headers: cabecerasCruzVerde(),
        body: metodo === "POST" ? "{}" : undefined,
      });
      const cookie = extraerCookieConnectSid(respuesta);
      if (cookie) {
        return cookie;
      }
    } catch {
      continue;
    }
  }

  // Último recurso: cualquier respuesta sirve, incluso un 401 suele traer
  // el Set-Cookie que necesitamos.
  for (const url of [
    `${BASE}/search-suggestions?q=a&limit=1`,
    "https://api.cruzverde.com.co/",
    `${ORIGEN}/`,
  ]) {
    try {
      const respuesta = await fetchConTimeout(url, {
        headers: cabecerasCruzVerde(),
      });
      const cookie = extraerCookieConnectSid(respuesta);
      if (cookie) {
        return cookie;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function precioCruzVerde(d: DetalleProductoCruzVerde): number | null {
  const precios = d.prices ?? {};
  const validos = [precios["price-sale-col"], precios["price-list-col"]].filter(
    (v): v is number => Boolean(v),
  );
  return validos.length > 0 ? Math.min(...validos) : null;
}

/**
 * `search-suggestions` es un endpoint de autocompletado (pensado para
 * texto parcial mientras se escribe), no de búsqueda de texto completo: con
 * un término de varias palabras aplica su propia corrección ortográfica y
 * puede devolver productos sin ninguna relación real (ej. "aceite de oliva"
 * corrige "aceite" a "active" y sugiere protector solar). Se descartan acá
 * los que no contengan, al menos, todas las palabras significativas del
 * término buscado.
 */
function esRelevante(d: DetalleProductoCruzVerde, palabras: string[]): boolean {
  const texto = `${d.name ?? ""} ${d.brand ?? ""}`.toLowerCase();
  return palabras.every((p) => texto.includes(p));
}

function parsearCruzVerde(
  id: string,
  d: DetalleProductoCruzVerde,
  imagen: string | undefined,
  categoria: string | undefined,
): Resultado {
  let nombre = (d.name ?? "?").trim();
  if (d.regulated && !d.skipPrescription) {
    nombre += "  [requiere fórmula]";
  }

  return {
    tienda: TIENDA,
    nombre,
    precio: precioCruzVerde(d),
    disponible: Boolean(d.stock),
    marca: d.brand ? capitalizarTitulo(d.brand) : "",
    url: d.pageURL ? `${ORIGEN}/${d.pageURL}/${id}.html` : undefined,
    imagen,
    categoria,
  };
}

/**
 * La imagen no viene en product-summary: hay que pedirla aparte al mismo
 * endpoint que usa la ficha de producto del sitio. No admite varios IDs a
 * la vez, así que se pide en paralelo solo para los productos que
 * realmente se van a mostrar (ya recortados a `limite`), no para todos los
 * candidatos que trajo la búsqueda.
 */
async function obtenerImagenProducto(
  id: string,
  cookie: string | null,
): Promise<string | undefined> {
  try {
    const respuesta = await fetchConTimeout(
      `${BASE}/detail/${id}?${new URLSearchParams({ inventoryId: ZONA })}`,
      { headers: cabecerasCruzVerde(cookie) },
    );
    if (respuesta.status !== 200) {
      return undefined;
    }

    const datos = (await respuesta.json()) as {
      productData?: {
        imageGroups?: Array<{
          images?: Array<{ dis_base_link?: string; link?: string }>;
        }>;
      };
    };
    const imagen = datos.productData?.imageGroups?.[0]?.images?.[0];
    return imagen?.dis_base_link ?? imagen?.link;
  } catch {
    return undefined;
  }
}

/**
 * Cruz Verde necesita dos llamadas, igual que hace su propia web:
 *   1. search-suggestions -> qué productos coinciden (IDs)
 *   2. product-summary    -> stock real, precios y slug
 *
 * La primera devuelve stock=0 para todo porque el inventario depende de la
 * zona; la segunda sí lo reporta bien gracias a inventoryId.
 */
export function crearAdaptadorCruzVerde(): Adaptador {
  return {
    tienda: TIENDA,
    async buscar(termino: string, limite: number): Promise<RespuestaTienda> {
      try {
        let cookie = await abrirSesion();

        const pedirSugerencias = () =>
          fetchConTimeout(
            `${BASE}/search-suggestions?${new URLSearchParams({
              q: termino,
              limit: String(Math.max(limite, 10)),
            })}`,
            { headers: cabecerasCruzVerde(cookie) },
          );

        // Un 401 suele venir CON un Set-Cookie nuevo, así que lo primero es
        // reintentar tal cual. Solo si eso falla se pide sesión desde cero.
        let respuesta = await pedirSugerencias();
        if (respuesta.status === 401) {
          respuesta = await pedirSugerencias();
        }
        if (respuesta.status === 401) {
          cookie = await abrirSesion();
          respuesta = await pedirSugerencias();
        }

        if (respuesta.status === 401) {
          return {
            tienda: TIENDA,
            resultados: [],
            error: "sin sesión — la tienda no entregó cookie de acceso",
          };
        }
        if (respuesta.status !== 200) {
          const detalle = (await respuesta.text()).trim().slice(0, 80);
          return {
            tienda: TIENDA,
            resultados: [],
            error: `HTTP ${respuesta.status}: ${detalle}`,
          };
        }

        const datosSugerencias = (await respuesta.json()) as {
          productSuggestions?: {
            products?: Array<{ productId?: string; categoryName?: string }>;
          };
        };
        const sugeridos = datosSugerencias.productSuggestions?.products ?? [];
        // categoryName solo viene en esta respuesta (search-suggestions), no
        // en product-summary, así que hay que llevarlo por id hasta el parseo final.
        const categoriaPorId = new Map(
          sugeridos
            .filter((p): p is { productId: string; categoryName?: string } =>
              Boolean(p.productId),
            )
            .map((p) => [p.productId, p.categoryName]),
        );
        const ids = sugeridos
          .map((p) => p.productId)
          .filter((id): id is string => Boolean(id))
          .slice(0, Math.max(limite, 10));

        if (ids.length === 0) {
          return { tienda: TIENDA, resultados: [] };
        }

        const parametrosDetalle = new URLSearchParams({ inventoryId: ZONA });
        for (const id of ids) {
          parametrosDetalle.append("ids", id);
        }
        for (const campo of CAMPOS) {
          parametrosDetalle.append("fields", campo);
        }

        const respuestaDetalle = await fetchConTimeout(
          `${BASE}/product-summary?${parametrosDetalle}`,
          { headers: cabecerasCruzVerde(cookie) },
        );

        if (respuestaDetalle.status !== 200) {
          return {
            tienda: TIENDA,
            resultados: [],
            error: `HTTP ${respuestaDetalle.status} en detalles`,
          };
        }

        const detalles = (await respuestaDetalle.json()) as Record<
          string,
          DetalleProductoCruzVerde
        >;

        const palabras = palabrasSignificativas(termino).map((p) =>
          p.toLowerCase(),
        );
        const idsConDetalle = ids.filter((id) => id in detalles);
        const idsRelevantes =
          palabras.length > 0
            ? idsConDetalle.filter((id) => esRelevante(detalles[id], palabras))
            : idsConDetalle;

        const idsAMostrar = idsRelevantes.slice(0, limite);

        const resultados = await Promise.all(
          idsAMostrar.map(async (id) => {
            const imagen = await obtenerImagenProducto(id, cookie);
            return parsearCruzVerde(id, detalles[id], imagen, categoriaPorId.get(id));
          }),
        );

        return { tienda: TIENDA, resultados };
      } catch (error) {
        if (esErrorDeTimeout(error)) {
          return { tienda: TIENDA, resultados: [], error: "timeout" };
        }
        return {
          tienda: TIENDA,
          resultados: [],
          error: `red: ${describirError(error)}`,
        };
      }
    },
  };
}
