import { TIENDAS } from "./adaptadores/tiendas";
import type { Adaptador } from "./adaptadores/tipos";
import type { Cache } from "./cache";
import type { RespuestaTienda } from "./tipos";

export interface EventoBusqueda {
  respuesta: RespuestaTienda;
  deCache: boolean;
}

function claveCache(tienda: string, termino: string, limite: number): string {
  return `${tienda}|${termino.toLowerCase()}|${limite}`;
}

export async function buscarEnTienda(
  adaptador: Adaptador,
  termino: string,
  limite: number,
  cache: Cache<RespuestaTienda>,
): Promise<EventoBusqueda> {
  const clave = claveCache(adaptador.tienda, termino, limite);
  const cacheada = cache.leer(clave);
  if (cacheada) {
    return { respuesta: cacheada, deCache: true };
  }

  let respuesta: RespuestaTienda;
  try {
    respuesta = await adaptador.buscar(termino, limite);
  } catch (error) {
    respuesta = {
      tienda: adaptador.tienda,
      resultados: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  cache.guardar(clave, respuesta);
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
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      await Promise.all(
        tiendas.map(async (adaptador) => {
          const evento = await buscarEnTienda(adaptador, termino, limite, cache);
          controller.enqueue(encoder.encode(`${JSON.stringify(evento)}\n`));
        }),
      );
      controller.close();
    },
  });
}
