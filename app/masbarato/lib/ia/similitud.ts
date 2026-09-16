import type { Resultado } from "../tipos";

// Modelo multilingüe (español incluido) pequeño para similitud de frases
// cortas: encaja con nombres de producto, a diferencia de un modelo de
// una sola lengua o pensado para párrafos largos.
const MODELO_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

// Por debajo de este puntaje (coseno, ambos vectores normalizados) se
// considera que el candidato no tiene relación real con la búsqueda —
// mismo criterio que el filtro de texto literal de cada adaptador, pero
// tolerante a género/número/sinónimos. Es un valor heurístico: si en la
// práctica dejara pasar demasiado ruido o descartara coincidencias
// válidas, hay que ajustarlo aquí, no repartirlo por el código.
const UMBRAL_SIMILITUD_MINIMA = 0.2;

export interface ModelDownloadProgress {
  file: string;
  percentage: number;
}

type ProgressCallback = (progress: ModelDownloadProgress) => void;

interface RawProgressEvent {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

interface TensorConLista {
  tolist(): number[][];
}

type Extractor = (
  textos: string[],
  opciones: { pooling: string; normalize: boolean },
) => Promise<TensorConLista>;

let extractorPromise: Promise<Extractor> | null = null;

/**
 * El pipeline se crea una sola vez por sesión de la pestaña (igual que
 * `whisperClient.ts`): la descarga del modelo pesa, pero el navegador la
 * cachea (Cache Storage de `@xenova/transformers`) y no hace falta
 * repetirla entre búsquedas ni recargar el modelo en memoria cada vez.
 */
async function obtenerExtractor(onProgress: ProgressCallback): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async (): Promise<Extractor> => {
      const { pipeline } = await import("@xenova/transformers");
      return pipeline("feature-extraction", MODELO_ID, {
        progress_callback: (event: RawProgressEvent): void => {
          if (event.status !== "progress" || !event.file || !event.total) {
            return;
          }
          onProgress({
            file: event.file,
            percentage: Math.round(((event.loaded ?? 0) / event.total) * 100),
          });
        },
      }) as unknown as Promise<Extractor>;
    })();
  }
  return extractorPromise;
}

function productoPunto(a: number[], b: number[]): number {
  let suma = 0;
  for (let i = 0; i < a.length; i += 1) {
    suma += a[i] * b[i];
  }
  return suma;
}

/**
 * Similitud coseno entre `consulta` y cada uno de `textos`. Los vectores
 * salen normalizados del extractor (`normalize: true`), así que la
 * similitud coseno es directamente el producto punto.
 */
export async function calcularSimilitudes(
  consulta: string,
  textos: string[],
  onProgress: ProgressCallback,
): Promise<number[]> {
  if (textos.length === 0) {
    return [];
  }
  const extractor = await obtenerExtractor(onProgress);
  const salida = await extractor([consulta, ...textos], {
    pooling: "mean",
    normalize: true,
  });
  const [vectorConsulta, ...vectoresTextos] = salida.tolist();
  return vectoresTextos.map((v) => productoPunto(v, vectorConsulta));
}

/**
 * Reemplaza el filtro de texto literal de cada adaptador (`esRelevante`,
 * uno por tienda) por un filtro semántico único: pensado para resultados
 * pedidos con `{ crudo: true }` (sin ese filtro aplicado en el servidor).
 * Descarta lo que no llega al umbral mínimo y ordena de mayor a menor
 * similitud, igual que antes se ordenaba por coincidencia de texto — el
 * orden por precio lo vuelve a aplicar `ordenarPorPrecio` más adelante en
 * la UI, esto solo decide *cuáles* de los `limite` candidatos mostrar.
 */
export async function rerankearPorSimilitud(
  consulta: string,
  resultados: Resultado[],
  limite: number,
  onProgress: ProgressCallback,
): Promise<Resultado[]> {
  if (resultados.length === 0) {
    return resultados;
  }
  const textos = resultados.map((r) => `${r.marca ?? ""} ${r.nombre}`.trim());
  const similitudes = await calcularSimilitudes(consulta, textos, onProgress);

  return resultados
    .map((r, i) => ({ resultado: r, similitud: similitudes[i] }))
    .filter((x) => x.similitud >= UMBRAL_SIMILITUD_MINIMA)
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, limite)
    .map((x) => x.resultado);
}
