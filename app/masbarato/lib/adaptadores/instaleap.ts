import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador } from "./tipos";
import { TIMEOUT_MS, cabecerasBase, describirError, fetchConTimeout } from "./http";

export interface RespuestaHttp {
  status: number;
  texto: () => Promise<string>;
}

export type ObtenerInstaleap = (
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
) => Promise<RespuestaHttp>;

interface ProductoInstaleap {
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
 * Varias droguerías/tiendas colombianas corren sobre Instaleap y no exponen
 * su búsqueda como una API JSON consumible: el listado con precio y stock se
 * resuelve enteramente en el servidor y se envía al navegador como React
 * Server Component (Next.js "flight" wire format), no como un endpoint
 * GraphQL independiente — el único GraphQL que llega al cliente es para
 * sugerencias del buscador (sin precio) y para analítica. Pidiendo la misma
 * ruta que usa el sitio con el header `RSC: 1` se obtiene ese payload
 * directamente, sin sesión ni CORS.
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

function esProductoInstaleap(valor: unknown): valor is ProductoInstaleap {
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

function precioEfectivo(p: ProductoInstaleap): number {
  const promo = p.promotionPricePerSubUnit;
  return typeof promo === "number" && promo > 0 && promo < p.price
    ? promo
    : p.price;
}

export function parsearProducto(
  p: ProductoInstaleap,
  mapa: Map<string, unknown>,
  tienda: string,
  origen: string,
): Resultado {
  const fotos = resolverRef(p.photosUrl, mapa);
  const imagen = Array.isArray(fotos) ? fotos[0] : undefined;

  return {
    tienda,
    nombre: p.name.trim(),
    precio: precioEfectivo(p),
    disponible: Boolean(p.isAvailable),
    marca: p.brand || "",
    url: p.slug ? `${origen}/p/${p.slug}` : undefined,
    imagen: typeof imagen === "string" ? imagen : undefined,
  };
}

export async function obtenerConFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<RespuestaHttp> {
  const respuesta = await fetchConTimeout(url, { headers }, timeoutMs);
  return { status: respuesta.status, texto: () => respuesta.text() };
}

export function crearAdaptadorInstaleap(opciones: {
  tienda: string;
  origen: string;
  obtener: ObtenerInstaleap;
  esTimeout: (error: unknown) => boolean;
}): Adaptador {
  const { tienda, origen, obtener, esTimeout } = opciones;

  return {
    tienda,
    async buscar(termino: string, limite: number): Promise<RespuestaTienda> {
      try {
        const respuesta = await obtener(
          `${origen}/search?${new URLSearchParams({ name: termino })}`,
          { ...cabecerasBase(), RSC: "1" },
          TIMEOUT_MS,
        );

        if (respuesta.status !== 200) {
          return {
            tienda,
            resultados: [],
            error: `HTTP ${respuesta.status}`,
          };
        }

        const mapa = parsearPayloadFlight(await respuesta.texto());
        const productos = Array.from(mapa.values()).filter(esProductoInstaleap);
        productos.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

        return {
          tienda,
          resultados: productos
            .slice(0, limite)
            .map((p) => parsearProducto(p, mapa, tienda, origen)),
        };
      } catch (error) {
        if (esTimeout(error)) {
          return { tienda, resultados: [], error: "timeout" };
        }
        return {
          tienda,
          resultados: [],
          error: `red: ${describirError(error)}`,
        };
      }
    },
  };
}
