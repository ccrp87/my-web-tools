import type { Resultado, RespuestaTienda } from "../tipos";
import type { Adaptador } from "./tipos";
import { limpiarPrecio } from "../precio";
import {
  cabecerasBase,
  describirError,
  esErrorDeTimeout,
  fetchConTimeout,
} from "./http";
import { tokenizarTermino } from "./tokenizar";

const RUTA_BUSQUEDA = "/wp-admin/admin-ajax.php";

interface SugerenciaFlatsome {
  type?: string;
  id?: number;
  value?: string;
  url?: string;
  img?: string;
  price?: string;
}

/** "&#36;" -> "$" (entidades HTML numéricas que trae el campo price). */
function decodificarEntidadesNumericas(texto: string): string {
  return texto.replace(/&#(\d+);/g, (_, codigo: string) =>
    String.fromCharCode(Number(codigo)),
  );
}

function quitarEtiquetas(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

/**
 * El campo "price" trae HTML de WooCommerce: un monto simple, o, en oferta,
 * el precio original en <del> y el vigente en <ins>. Solo interesa el
 * vigente, que ya viene calculado por la tienda.
 */
export function precioFlatsome(precioHtml: string | undefined): number | null {
  if (!precioHtml) {
    return null;
  }
  const conOferta = /<ins[^>]*>([\s\S]*?)<\/ins>/.exec(precioHtml);
  const fragmento = conOferta ? conOferta[1] : precioHtml;
  return limpiarPrecio(decodificarEntidadesNumericas(quitarEtiquetas(fragmento)));
}

/**
 * El buscador ajax de Flatsome es de autocompletado, igual que
 * search-suggestions en Cruz Verde: puede aplicar su propia corrección
 * ortográfica y devolver productos sin relación real con el término. Solo
 * se filtra con 2+ palabras significativas: con una sola, un sinónimo
 * válido resuelto por el buscador remoto no debe descartarse por texto
 * literal.
 */
function esRelevante(s: SugerenciaFlatsome, palabras: string[]): boolean {
  const texto = (s.value ?? "").toLowerCase();
  return palabras.every((p) => texto.includes(p));
}

function parsearSugerencia(tienda: string, s: SugerenciaFlatsome): Resultado {
  return {
    tienda,
    nombre: s.value ?? "?",
    precio: precioFlatsome(s.price),
    // El endpoint de búsqueda no reporta stock; se asume disponible, ya que
    // no hay forma de distinguir "agotado" de "sin dato" con lo que devuelve.
    disponible: true,
    url: s.url ?? "",
    imagen: s.img,
  };
}

/**
 * Tiendas con WordPress + WooCommerce + tema Flatsome exponen este buscador
 * ajax nativo del tema: JSON con sugerencias, sin necesidad de credenciales
 * ni de tokenizar la consulta (a diferencia de VTEX, acepta varias palabras).
 */
export function crearAdaptadorFlatsome(
  tienda: string,
  baseUrl: string,
): Adaptador {
  const base = baseUrl.replace(/\/$/, "");

  return {
    tienda,
    async buscar(termino: string, limite: number): Promise<RespuestaTienda> {
      const params = new URLSearchParams({
        action: "flatsome_ajax_search_products",
        query: termino,
      });

      try {
        const respuesta = await fetchConTimeout(
          `${base}${RUTA_BUSQUEDA}?${params}`,
          { headers: cabecerasBase() },
        );

        if (respuesta.status !== 200) {
          const detalle =
            (await respuesta.text()).trim().slice(0, 80) ||
            `HTTP ${respuesta.status}`;
          return {
            tienda,
            resultados: [],
            error: `HTTP ${respuesta.status}: ${detalle}`,
          };
        }

        const datos = (await respuesta.json()) as {
          suggestions?: SugerenciaFlatsome[];
        };
        let productos = (datos.suggestions ?? []).filter(
          (s) => s.type === "Product",
        );

        const { filtros } = tokenizarTermino(termino);
        if (filtros.length > 0) {
          const palabras = filtros.map((p) => p.toLowerCase());
          productos = productos.filter((s) => esRelevante(s, palabras));
        }

        return {
          tienda,
          resultados: productos.slice(0, limite).map((s) => parsearSugerencia(tienda, s)),
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
