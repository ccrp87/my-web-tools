import type { Resultado, RespuestaTienda } from "../tipos";
import type { Presentacion, UnidadBase } from "../presentacion";
import type { Adaptador, OpcionesBusqueda } from "./tipos";
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
  "Factor Neto PUM"?: string[];
  "Unidad de Medida PUM Calculado"?: string[];
  categories?: string[];
}

/**
 * VTEX reporta `categories` como rutas completas ("/Mercado/Despensa/Aceites
 * y Vinagres/"), la más específica primero. Se toma el último segmento no
 * vacío de la primera ruta.
 */
function leerCategoriaVtex(producto: ProductoVtex): string | undefined {
  const ruta = producto.categories?.[0];
  if (!ruta) {
    return undefined;
  }
  const segmentos = ruta.split("/").filter(Boolean);
  return segmentos.at(-1);
}

const UNIDADES_PUM: Record<string, { unidad: UnidadBase; factor: number }> = {
  Mililitro: { unidad: "ml", factor: 1 },
  Litro: { unidad: "ml", factor: 1000 },
  Gramo: { unidad: "g", factor: 1 },
  Kilogramo: { unidad: "g", factor: 1000 },
  Unidad: { unidad: "unidad", factor: 1 },
};

/**
 * VTEX expone precio-por-unidad-de-medida como especificación de producto
 * ("Factor Neto PUM" + "Unidad de Medida PUM Calculado"), por la regulación
 * colombiana de metrología legal — más confiable que adivinar la
 * presentación a partir del nombre. Cuando la unidad reportada no está en
 * este mapeo significa que el producto no se mide por volumen/peso/conteo
 * de forma que sepamos comparar, no que falte el dato: se devuelve null
 * igual que si no hubiera especificación.
 */
function leerPumVtex(producto: ProductoVtex): Presentacion | null {
  const unidadTexto = producto["Unidad de Medida PUM Calculado"]?.[0];
  const factorTexto = producto["Factor Neto PUM"]?.[0];
  if (!unidadTexto || !factorTexto) {
    return null;
  }
  const mapeo = UNIDADES_PUM[unidadTexto];
  if (!mapeo) {
    return null;
  }
  const cantidad = Number.parseFloat(factorTexto.replace(",", "."));
  if (Number.isNaN(cantidad) || cantidad <= 0) {
    return null;
  }
  return { cantidad: cantidad * mapeo.factor, unidad: mapeo.unidad };
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
      presentacion: leerPumVtex(producto) ?? undefined,
      categoria: leerCategoriaVtex(producto),
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
    async buscar(
      termino: string,
      limite: number,
      opciones: OpcionesBusqueda = {},
    ): Promise<RespuestaTienda> {
      const { clave, filtros } = tokenizarTermino(termino);
      const { crudo = false } = opciones;
      // Si hay que filtrar en local (o el modo IA quiere candidatos crudos
      // para re-rankear), se pide un lote más grande.
      const tope = crudo || filtros.length > 0 ? 49 : Math.max(0, limite - 1);
      const params = new URLSearchParams({
        ft: clave,
        _from: "0",
        _to: String(tope),
        // Sin esto, VTEX ordena por relevancia: el producto más barato del
        // catálogo puede no estar entre los primeros `tope` resultados y se
        // pierde por completo antes de llegar a filtrar/recortar por `limite`.
        O: "OrderByPriceASC",
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

        if (!crudo && filtros.length > 0) {
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
