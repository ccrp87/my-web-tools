import { TIENDAS } from "./adaptadores/tiendas";
import type { Adaptador, OpcionesBusqueda } from "./adaptadores/tipos";
import type { Cache } from "./cache";
import type { RespuestaTienda } from "./tipos";

export interface EventoBusqueda {
  respuesta: RespuestaTienda;
  deCache: boolean;
}

// El modo crudo (IA) devuelve candidatos distintos a los del modo normal
// para el mismo término/límite: hay que cachearlos aparte, si no una
// búsqueda pisaría el resultado de la otra.
function claveCache(
  tienda: string,
  termino: string,
  limite: number,
  crudo: boolean,
): string {
  return `${tienda}|${termino.toLowerCase()}|${limite}|${crudo ? "crudo" : "filtrado"}`;
}

export async function buscarEnTienda(
  adaptador: Adaptador,
  termino: string,
  limite: number,
  cache: Cache<RespuestaTienda>,
  opciones: OpcionesBusqueda = {},
): Promise<EventoBusqueda> {
  const clave = claveCache(adaptador.tienda, termino, limite, Boolean(opciones.crudo));
  const cacheada = cache.leer(clave);
  if (cacheada) {
    return { respuesta: cacheada, deCache: true };
  }

  let respuesta: RespuestaTienda;
  try {
    respuesta = await adaptador.buscar(termino, limite, opciones);
  } catch (error) {
    respuesta = {
      tienda: adaptador.tienda,
      resultados: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Un error (timeout, WAF, red) es casi siempre transitorio: cachearlo
  // dejaría a la tienda mostrando "sin resultados" hasta por CACHE_TTL_MS
  // aunque la siguiente petición sí hubiera funcionado.
  if (!respuesta.error) {
    cache.guardar(clave, respuesta);
  }
  return { respuesta, deCache: false };
}

/**
 * Un evento NDJSON por tienda, emitido tan pronto esa tienda responde: una
 * tienda lenta o caída no debe retrasar a las demás en pantalla, igual que
 * el ThreadPoolExecutor + as_completed del CLI original.
 */
export function crearFlujoBusqueda(
  termino: string,
  limite: number,
  cache: Cache<RespuestaTienda>,
  tiendas: readonly Adaptador[] = TIENDAS,
  opciones: OpcionesBusqueda = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      await Promise.all(
        tiendas.map(async (adaptador) => {
          const evento = await buscarEnTienda(
            adaptador,
            termino,
            limite,
            cache,
            opciones,
          );
          controller.enqueue(encoder.encode(`${JSON.stringify(evento)}\n`));
        }),
      );
      controller.close();
    },
  });
}
