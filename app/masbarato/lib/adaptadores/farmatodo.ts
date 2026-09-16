import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador, OpcionesBusqueda } from "./tipos";
import {
  cabecerasBase,
  describirError,
  esErrorDeTimeout,
  fetchConTimeout,
} from "./http";
import { tokenizarTermino } from "./tokenizar";

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
  categorie?: string;
  classification?: Array<{ id?: number; name?: string; typeId?: number }>;
}

/**
 * `classification` trae departamento/categoría/subcategoría con `typeId`
 * creciente según se especifica más (1=DEPARTAMENTO, 2=CATEGORIA,
 * 3=SUBCATEGORIA...); se toma el de mayor `typeId`. Si no viene, se cae al
 * nombre de categoría general (`categorie`).
 */
function leerCategoriaFarmatodo(hit: HitFarmatodo): string | undefined {
  const clasificacion = hit.classification ?? [];
  const masEspecifica = clasificacion.reduce<
    (typeof clasificacion)[number] | undefined
  >((mejor, actual) => {
    if (!actual?.name) return mejor;
    if (!mejor || (actual.typeId ?? 0) > (mejor.typeId ?? 0)) return actual;
    return mejor;
  }, undefined);
  return masEspecifica?.name ?? hit.categorie;
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

/**
 * Igual que en Alkosto/Instaleap/Cruz Verde: Algolia puede aflojar el
 * término (typo tolerance / palabras opcionales) cuando no hay coincidencias
 * reales, devolviendo productos sin relación con lo buscado. Solo se filtra
 * con 2+ palabras significativas: con una sola, un sinónimo válido resuelto
 * por Algolia no debe descartarse por texto literal.
 *
 * El filtro exige coincidencia literal, pero Algolia ya resuelve género/
 * número y sinónimos por su cuenta (ej. "paños húmedos" -> "Toallitas
 * Húmedas": ni "paños" ni "húmedos" aparecen tal cual). Si el filtro deja
 * todo fuera, esos hits siguen siendo la mejor respuesta que dio la tienda:
 * mejor mostrarlos sin filtrar que un vacío engañoso (mismo criterio que
 * VTEX en vtex.ts).
 */
function esRelevante(hit: HitFarmatodo, palabras: string[]): boolean {
  const texto = `${hit.mediaDescription ?? ""} ${hit.marca ?? ""} ${hit.largeDescription ?? ""}`.toLowerCase();
  return palabras.every((p) => texto.includes(p));
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
    categoria: leerCategoriaFarmatodo(hit),
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
    async buscar(
      termino: string,
      limite: number,
      opciones: OpcionesBusqueda = {},
    ): Promise<RespuestaTienda> {
      const { filtros } = tokenizarTermino(termino);
      const { crudo = false } = opciones;
      const palabras = filtros.map((p) => p.toLowerCase());
      const params = new URLSearchParams({
        hitsPerPage: String(Math.max(limite, crudo || palabras.length > 0 ? 50 : 10)),
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
        const coinciden =
          !crudo && palabras.length > 0
            ? hits.filter((h) => esRelevante(h, palabras))
            : hits;
        const relevantes = coinciden.length > 0 ? coinciden : hits;

        return {
          tienda: TIENDA,
          resultados: relevantes.slice(0, limite).map(parsearFarmatodo),
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
