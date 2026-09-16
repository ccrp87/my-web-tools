import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador, OpcionesBusqueda } from "./tipos";
import {
  describirError,
  esErrorDeTimeout,
  fetchConTimeout,
} from "./http";
import { tokenizarTermino } from "./tokenizar";

const TIENDA = "Alkosto";
const ORIGEN = "https://www.alkosto.com";

/**
 * Alkosto (SAP Hybris) busca con Algolia. `APP_ID` e `INDICE` están en el
 * bundle público del sitio (`ACC.config.algolia`), y `API_KEY` es una
 * search-only key sin permisos de escritura: expuesta a propósito para que
 * el navegador del cliente consulte Algolia directamente, igual de público
 * que cualquier otro dato del HTML.
 */
const APP_ID = "QX5IPS1B1Q";
const API_KEY = "7a8800d62203ee3a9ff1cdf74f99b268";
// Réplica ordenada por precio ascendente (mismos registros que
// "alkostoIndexAlgoliaPRD", solo cambia el criterio de orden): sin esto,
// Algolia devuelve por relevancia y el producto más barato puede quedar
// fuera del lote que se pide, igual que pasaba con VTEX antes de OrderByPriceASC.
const INDICE = "alkostoIndexAlgoliaPRD_price_asc";
const ENDPOINT = `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDICE}/query`;

interface HitAlkosto {
  name_text_es?: string;
  marca_text?: string;
  code_string?: string;
  url_es_string?: string;
  pricevalue_cop_double?: number;
  discountprice_double?: number;
  instockflag_boolean?: boolean;
  "img-310wx310h_string"?: string;
  categoryname_text_es_mv?: string[];
}

/**
 * `pricevalue_cop_double` es el precio de lista; cuando el producto tiene
 * descuento activo, Alkosto agrega `discountprice_double` con el precio
 * real a pagar (más bajo). Sin descuento, ese campo no viene en el hit.
 */
function precioAlkosto(hit: HitAlkosto): number | null {
  const lista = hit.pricevalue_cop_double;
  const descuento = hit.discountprice_double;
  if (typeof descuento === "number" && descuento > 0) {
    return descuento;
  }
  return typeof lista === "number" ? lista : null;
}

/**
 * El índice ordenado por precio (`INDICE`) prioriza precio ascendente sobre
 * relevancia textual, y Algolia afloja la búsqueda cuando el término no
 * coincide con nada — sin este filtro, un término de varias palabras sin
 * coincidencias reales en Alkosto termina mostrando los productos más
 * baratos del catálogo entero, sin ninguna relación con lo buscado (mismo
 * problema que search-suggestions en Cruz Verde, ver cruzverde.ts). Con una
 * sola palabra no se filtra: ahí Algolia puede resolver sinónimos válidos
 * (ej. "televisor" -> "TV") que un filtro de texto literal descartaría.
 *
 * A diferencia de VTEX, aquí NO se cae a los hits sin filtrar cuando el
 * filtro deja todo fuera: el índice está ordenado por precio, no por
 * relevancia, así que "sin filtrar" son productos baratos de cualquier
 * categoría, no candidatos plausibles — un vacío es la respuesta correcta.
 * La excepción es el modo IA (`opciones.crudo`): ahí el cliente reemplaza
 * este filtro de texto por su propio filtro de similitud semántica, que sí
 * detecta y descarta esos productos sin relación.
 */
function esRelevante(hit: HitAlkosto, palabras: string[]): boolean {
  const texto = `${hit.name_text_es ?? ""} ${hit.marca_text ?? ""}`.toLowerCase();
  return palabras.every((p) => texto.includes(p));
}

/** `categoryname_text_es_mv` trae la ruta como nombres, la más específica al final (al revés que VTEX). */
function leerCategoriaAlkosto(hit: HitAlkosto): string | undefined {
  return hit.categoryname_text_es_mv?.at(-1);
}

function parsearAlkosto(hit: HitAlkosto): Resultado {
  return {
    tienda: TIENDA,
    nombre: (hit.name_text_es ?? "?").trim(),
    precio: precioAlkosto(hit),
    disponible: Boolean(hit.instockflag_boolean),
    marca: hit.marca_text ?? "",
    url: hit.url_es_string ? `${ORIGEN}${hit.url_es_string}` : undefined,
    imagen: hit["img-310wx310h_string"],
    categoria: leerCategoriaAlkosto(hit),
  };
}

export function crearAdaptadorAlkosto(): Adaptador {
  return {
    tienda: TIENDA,
    async buscar(
      termino: string,
      limite: number,
      opciones: OpcionesBusqueda = {},
    ): Promise<RespuestaTienda> {
      const { filtros } = tokenizarTermino(termino);
      const { crudo = false } = opciones;
      const palabras = filtros.map((p) => p.toLowerCase());
      try {
        const respuesta = await fetchConTimeout(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Algolia-Application-Id": APP_ID,
            "X-Algolia-API-Key": API_KEY,
          },
          body: JSON.stringify({
            query: termino,
            // Pide un lote más grande que `limite`: al filtrar por
            // relevancia localmente, los primeros `limite` que trae el
            // índice (ordenado por precio) pueden no ser los relevantes.
            hitsPerPage: Math.max(limite, 50),
          }),
        });

        if (respuesta.status !== 200) {
          const detalle = (await respuesta.text()).trim().slice(0, 100);
          return {
            tienda: TIENDA,
            resultados: [],
            error: `HTTP ${respuesta.status}: ${detalle}`,
          };
        }

        const datos = (await respuesta.json()) as { hits?: HitAlkosto[] };
        const hits = datos.hits ?? [];
        const relevantes =
          !crudo && palabras.length > 0
            ? hits.filter((h) => esRelevante(h, palabras))
            : hits;

        return {
          tienda: TIENDA,
          resultados: relevantes.slice(0, limite).map(parsearAlkosto),
        };
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
