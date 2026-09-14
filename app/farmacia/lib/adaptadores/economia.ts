import { request as peticionHttps } from "node:https";
import { rootCertificates } from "node:tls";
import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador } from "./tipos";
import { TIMEOUT_MS, cabecerasBase, describirError } from "./http";

const TIENDA = "La Economía";
const ORIGEN = "https://www.droguerialaeconomia.com";

/**
 * El servidor de droguerialaeconomia.com no envía el certificado
 * intermedio de su cadena TLS, solo el certificado hoja. Los navegadores
 * lo toleran completando la cadena por su cuenta (AIA), pero Node no lo
 * hace, así que cualquier fetch normal falla con "unable to verify the
 * first certificate" — no es un problema de nuestro código ni de la
 * confianza del sistema, sino de cómo el servidor sirve su certificado.
 * Se agrega el intermedio público de Sectigo como CA adicional junto a
 * las raíces normales de Node (`rootCertificates`); la verificación
 * sigue activa, solo se completa la cadena que el servidor omite.
 */
const INTERMEDIO_SECTIGO_OV_R36 = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQLBo8dulD3d3/GRsxiQrtcTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgT1YgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEApkMtJ3R06jo0fceI0M52B7K+TyMeGcv2BQ5AVc3j
lYt76TvHIu/nNe22W/RJXX9rWUD/2GE6GF5x0V4bsY7K3IeJ8E7+KzG/TGboySfD
u+F52jqQBbY62ofhYjMeiAbLI02+FqwHeM8uIrUtcX8b2RCxF358TB0NHVccAXZc
FYgZndZCeXxjuca7pJJ20LLUnXtgXcjAE1vY4WvbReW0W6mkeZyNGdmpTcFs5Y+s
yy6LtE5Zocji9J9NlNnReox2RWVyEXpA1ChZ4gqN+ZpVSIQ0HBorVFbBKyhdZyEX
gZgNSNtBRwxqwIzJePJhYd4ZUhO1vk+/uP3nwDk0p95q/j7naXNCSvESnrHPypaB
WRK066nKfPRPi9m9kIOhMdYfS8giFRTcdgL24Ycilj7ecAK9Trh0VbjwouJ4WH+x
bt47u68ZFCD/ac55I0DNHkCpaPruj6e9Rmr7K46wZDAYXuEAqB7tGG/jd6JAA+H2
O44CV98NRsU213f1kScIZntNAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQU42Z0u3BojSxdTg6mSo+bNyKcgpIw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgIw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
BZXWDHWC3cubb/e1I1kzi8lPFiK/ZUoH09ufmVOrc5ObYH/XKkWUexSPqRkwKFKr
7r8OuG+p7VNB8rifX6uopqKAgsvZtZsq7iAFw04To6vNcxeBt1Eush3cQ4b8nbQR
MQLChgEAqwhuXp9P48T4QEBSksYav7+aFjNySsLYlPzNqVM3RNwvBdvp6vgDtGwc
xlKQZVuuNVIaoYyls8swhxDeSHKpRdxRauTLZ+pl+wGvy0pnrLEJGSz9mOEmfbod
e/XopR2NGqaHJ6bIjyxPu6UtyQGI26En7UAEozACrHz06Nx2jTAY9E6NeB6XuobE
wLK025ZRmvglcURG1BrV24tGHHTgxCe8M3oGlpUSMTKQ2dkgljZVYt+gKdFtWELZ
MuRdi+X3XsrR8LFz+aLUiDRfQqhmw3RxjIyVKvvu9UPYY1nsvxYmFnUSeM+2q1z/
iPUry+xDY9MC6+IhleKT094VKdFVp7LXH42+wvU+17lRolQ2mK2N/nBLVBwaIhib
QXw4VYKwB86Bc6eS6iqsc94KEgD/U4VsjmgfhK+Xp4NM+VYzTTa3QeV3p8xOM0cw
q1p8oZFA+OBcz3FYWpDIe5j0NWKlw9hXsTyPY/HeZUV59akskSOSRSmDfe8wJDPX
58uB9/7lud0G3x0pxQAcffP0ayKavNwDTw4UfJ34cEw=
-----END CERTIFICATE-----`;

const CADENA_CA = [...rootCertificates, INTERMEDIO_SECTIGO_OV_R36];

interface RespuestaHttps {
  status: number;
  texto: () => Promise<string>;
}

function obtenerConCadenaCompleta(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<RespuestaHttps> {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    const solicitud = peticionHttps(
      {
        hostname,
        path: `${pathname}${search}`,
        method: "GET",
        headers,
        ca: CADENA_CA,
      },
      (res) => {
        const trozos: Buffer[] = [];
        res.on("data", (trozo: Buffer) => trozos.push(trozo));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            texto: async () => Buffer.concat(trozos).toString("utf-8"),
          });
        });
        res.on("error", reject);
      },
    );
    solicitud.setTimeout(timeoutMs, () => {
      solicitud.destroy(new Error("timeout"));
    });
    solicitud.on("error", reject);
    solicitud.end();
  });
}

interface ProductoEconomia {
  name: string;
  sku: string;
  price: number;
  promotionPricePerSubUnit?: number | null;
  stock?: number;
  isAvailable?: boolean;
  slug?: string;
  brand?: string;
  photosUrl?: unknown;
  index?: number;
}

/**
 * La Económia (plataforma Instaleap) no expone su búsqueda como una API JSON
 * consumible: el listado con precio y stock se resuelve enteramente en el
 * servidor y se envía al navegador como React Server Component (Next.js
 * "flight" wire format), no como un endpoint GraphQL independiente — el
 * único GraphQL que llega al cliente es para sugerencias del buscador (sin
 * precio) y para analítica. Pidiendo la misma ruta que usa el sitio con el
 * header `RSC: 1` se obtiene ese payload directamente, sin sesión ni CORS.
 *
 * El formato es una secuencia de líneas `id:valorJSON`, donde cada producto
 * queda como un chunk propio con sus campos (name, price, sku, stock...) y
 * algunos valores son referencias "$id" a otros chunks (p. ej. las fotos).
 * Se parsea línea por línea y se identifican productos por tener a la vez
 * "sku", "price" y "name", en vez de intentar reconstruir el árbol completo
 * de React — más simple y resistente a cambios de estructura del árbol.
 */
export function parsearPayloadFlight(texto: string): Map<string, unknown> {
  const mapa = new Map<string, unknown>();
  for (const linea of texto.split("\n")) {
    const separador = linea.indexOf(":");
    if (separador === -1) continue;
    const id = linea.slice(0, separador);
    const crudo = linea.slice(separador + 1);
    const primerCaracter = crudo[0];
    if (!primerCaracter || !/[{["\d\-tfn]/.test(primerCaracter)) {
      continue; // Refs de componentes ("I[...]") o texto largo ("T509,...").
    }
    try {
      mapa.set(id, JSON.parse(crudo));
    } catch {
      // Línea no parseable como JSON suelto: se ignora.
    }
  }
  return mapa;
}

function resolverRef(valor: unknown, mapa: Map<string, unknown>): unknown {
  if (typeof valor === "string") {
    const match = /^\$([A-Za-z0-9_]+)$/.exec(valor);
    if (match && mapa.has(match[1])) {
      return mapa.get(match[1]);
    }
  }
  return valor;
}

function esProductoEconomia(valor: unknown): valor is ProductoEconomia {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return false;
  }
  const v = valor as Record<string, unknown>;
  return (
    typeof v.sku === "string" &&
    typeof v.price === "number" &&
    typeof v.name === "string"
  );
}

function precioEfectivo(p: ProductoEconomia): number {
  const promo = p.promotionPricePerSubUnit;
  return typeof promo === "number" && promo > 0 && promo < p.price
    ? promo
    : p.price;
}

export function parsearProducto(
  p: ProductoEconomia,
  mapa: Map<string, unknown>,
): Resultado {
  const fotos = resolverRef(p.photosUrl, mapa);
  const imagen = Array.isArray(fotos) ? fotos[0] : undefined;

  return {
    tienda: TIENDA,
    nombre: p.name.trim(),
    precio: precioEfectivo(p),
    disponible: Boolean(p.isAvailable),
    marca: p.brand || "",
    url: p.slug ? `${ORIGEN}/p/${p.slug}` : undefined,
    imagen: typeof imagen === "string" ? imagen : undefined,
  };
}

export function crearAdaptadorEconomia(): Adaptador {
  return {
    tienda: TIENDA,
    async buscar(termino: string, limite: number): Promise<RespuestaTienda> {
      try {
        const respuesta = await obtenerConCadenaCompleta(
          `${ORIGEN}/search?${new URLSearchParams({ name: termino })}`,
          { ...cabecerasBase(), RSC: "1" },
          TIMEOUT_MS,
        );

        if (respuesta.status !== 200) {
          return {
            tienda: TIENDA,
            resultados: [],
            error: `HTTP ${respuesta.status}`,
          };
        }

        const mapa = parsearPayloadFlight(await respuesta.texto());
        const productos = Array.from(mapa.values()).filter(esProductoEconomia);
        productos.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

        return {
          tienda: TIENDA,
          resultados: productos
            .slice(0, limite)
            .map((p) => parsearProducto(p, mapa)),
        };
      } catch (error) {
        if (error instanceof Error && error.message === "timeout") {
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
