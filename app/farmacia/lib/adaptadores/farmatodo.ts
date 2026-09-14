import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador } from "./tipos";
import {
  cabecerasBase,
  describirError,
  esErrorDeTimeout,
  fetchConTimeout,
} from "./http";

const TIENDA = "Farmatodo";

const ENDPOINT =
  "https://api-search.farmatodo.com/1/indexes/*/queries" +
  "?x-algolia-agent=Algolia%20for%20JavaScript%20(4.26.0)%3B%20Browser";
const INDICE = "products-colombia";
const CIUDAD = "BOG"; // Cambia según dónde compres; afecta el precio.
const FILTROS = "outofstore:false  AND NOT rms_class:SAMPLING";

interface HitFarmatodo {
  mediaDescription?: string;
  mediaImageUrl?: string;
  marca?: string;
  largeDescription?: string;
  barcode?: string;
  fullPrice?: number;
  fullPriceByCity?: Array<{ cityCode?: string; fullPrice?: number }>;
  offerPrice?: number;
  primePrice?: number;
  hasStock?: boolean;
  requirePrescription?: string | boolean;
}

/**
 * Precio realmente pagable hoy, en la ciudad configurada.
 *
 *   fullPrice        precio normal
 *   fullPriceByCity  precio por ciudad (puede diferir del anterior)
 *   offerPrice       promoción vigente; 0 significa "sin oferta"
 *   primePrice       requiere membresía Prime -> se ignora, porque no es
 *                    comparable con el precio de las otras tiendas.
 */
function precioFarmatodo(hit: HitFarmatodo): number | null {
  const candidatos: number[] = [];

  let base = hit.fullPrice;
  for (const entrada of hit.fullPriceByCity ?? []) {
    if (entrada.cityCode === CIUDAD) {
      base = entrada.fullPrice ?? base;
      break;
    }
  }
  if (base) {
    candidatos.push(Number(base));
  }

  if (hit.offerPrice) {
    candidatos.push(Number(hit.offerPrice));
  }

  return candidatos.length > 0 ? Math.min(...candidatos) : null;
}

function parsearFarmatodo(hit: HitFarmatodo): Resultado {
  let nombre = (hit.mediaDescription ?? "?").trim().replace(/^\*+/, "").trim();

  // requirePrescription llega como cadena "true"/"false".
  const receta = String(hit.requirePrescription ?? "").toLowerCase() === "true";
  if (receta) {
    nombre += "  [requiere fórmula]";
  }

  return {
    tienda: TIENDA,
    nombre,
    precio: precioFarmatodo(hit),
    disponible: Boolean(hit.hasStock),
    marca: hit.marca ?? "",
    imagen: hit.mediaImageUrl,
  };
}

/**
 * Farmatodo busca con Algolia. El endpoint no requiere los tokens de sesión
 * que aparecen en otras peticiones del sitio: basta el término y los
 * filtros. Por eso aquí no se guarda ninguna credencial.
 */
export function crearAdaptadorFarmatodo(): Adaptador {
  return {
    tienda: TIENDA,
    async buscar(termino: string, limite: number): Promise<RespuestaTienda> {
      const params = new URLSearchParams({
        hitsPerPage: String(Math.max(limite, 10)),
        filters: FILTROS,
        page: "0",
      });
      const cuerpo = {
        requests: [
          { query: termino, indexName: INDICE, params: params.toString() },
        ],
      };

      try {
        const respuesta = await fetchConTimeout(ENDPOINT, {
          method: "POST",
          headers: { ...cabecerasBase(), "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        });

        if (respuesta.status !== 200) {
          let detalle = (await respuesta.text()).trim().slice(0, 100);
          if (respuesta.status === 401 || respuesta.status === 403) {
            detalle += "  (¿faltan headers x-algolia-api-key?)";
          }
          return {
            tienda: TIENDA,
            resultados: [],
            error: `HTTP ${respuesta.status}: ${detalle}`,
          };
        }

        const datos = (await respuesta.json()) as {
          results?: Array<{ hits?: HitFarmatodo[] }>;
        };
        const hits = datos.results?.[0]?.hits ?? [];

        return {
          tienda: TIENDA,
          resultados: hits.slice(0, limite).map(parsearFarmatodo),
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
