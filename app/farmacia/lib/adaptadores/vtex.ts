import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador } from "./tipos";
import {
  cabecerasBase,
  describirError,
  esErrorDeTimeout,
  fetchConTimeout,
} from "./http";
import { tokenizarTermino } from "./tokenizar";

const RUTA_CATALOGO = "/api/catalog_system/pub/products/search";

interface ProductoVtex {
  productName?: string;
  productTitle?: string;
  linkText?: string;
  brand?: string;
  productReference?: string;
  metaTagDescription?: string;
  link?: string;
  items?: Array<{
    images?: Array<{ imageUrl?: string }>;
    sellers?: Array<{
      commertialOffer?: {
        Price?: number;
        ListPrice?: number;
        AvailableQuantity?: number;
      };
    }>;
  }>;
}

function parsearProducto(
  tienda: string,
  base: string,
  producto: ProductoVtex,
): { resultado: Resultado; textoBusqueda: string } {
  const oferta = producto.items?.[0]?.sellers?.[0]?.commertialOffer;
  const precio = oferta?.Price ?? oferta?.ListPrice ?? null;
  const disponible = (oferta?.AvailableQuantity ?? 0) > 0;
  const imagen = producto.items?.[0]?.images?.[0]?.imageUrl;

  let url = producto.link ?? "";
  if (url.startsWith("/")) {
    url = base + url;
  }

  // El término buscado no siempre está en productName; productTitle,
  // brand, etc. también cuentan como coincidencia válida.
  const textoBusqueda = [
    producto.productName,
    producto.productTitle,
    producto.linkText,
    producto.brand,
    producto.productReference,
    producto.metaTagDescription,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .toLowerCase();

  return {
    resultado: {
      tienda,
      nombre: producto.productName ?? "?",
      precio,
      disponible,
      url,
      marca: producto.brand ?? "",
      imagen,
    },
    textoBusqueda,
  };
}

/**
 * Muchos retailers colombianos corren sobre VTEX, que expone un catálogo
 * público con una ruta estándar: JSON estructurado, sin parsear HTML.
 */
export function crearAdaptadorVtex(tienda: string, baseUrl: string): Adaptador {
  const base = baseUrl.replace(/\/$/, "");

  return {
    tienda,
    async buscar(termino: string, limite: number): Promise<RespuestaTienda> {
      const { clave, filtros } = tokenizarTermino(termino);
      // Si hay que filtrar en local, se pide un lote más grande.
      const tope = filtros.length > 0 ? 49 : Math.max(0, limite - 1);
      const params = new URLSearchParams({
        ft: clave,
        _from: "0",
        _to: String(tope),
      });

      try {
        const respuesta = await fetchConTimeout(
          `${base}${RUTA_CATALOGO}?${params}`,
          { headers: cabecerasBase() },
        );

        if (respuesta.status !== 200 && respuesta.status !== 206) {
          const detalle =
            (await respuesta.text()).trim().slice(0, 80) ||
            `HTTP ${respuesta.status}`;
          return {
            tienda,
            resultados: [],
            error: `HTTP ${respuesta.status}: ${detalle}`,
          };
        }

        const datos: unknown = await respuesta.json();
        if (!Array.isArray(datos)) {
          return {
            tienda,
            resultados: [],
            error: "devolvió HTML, no JSON (no es VTEX)",
          };
        }

        let productos = (datos as ProductoVtex[]).map((p) =>
          parsearProducto(tienda, base, p),
        );

        if (filtros.length > 0) {
          const filtrosMinuscula = filtros.map((f) => f.toLowerCase());
          const coinciden = productos.filter(({ textoBusqueda }) =>
            filtrosMinuscula.every((f) => textoBusqueda.includes(f)),
          );
          // Si el filtro deja todo fuera, mejor mostrar los sin filtrar
          // que un vacío: el usuario decide si le sirven.
          productos = coinciden.length > 0 ? coinciden : productos;
        }

        return {
          tienda,
          resultados: productos.slice(0, limite).map((p) => p.resultado),
        };
      } catch (error) {
        if (esErrorDeTimeout(error)) {
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
