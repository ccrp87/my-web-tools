export const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min: balance entre precios frescos y no saturar las tiendas.

export interface Cache<T> {
  leer(clave: string, ahora?: number): T | null;
  guardar(clave: string, datos: T, ahora?: number): void;
}

/**
 * Caché en memoria del proceso, no en disco: en un entorno serverless el
 * filesystem no persiste entre invocaciones, y para el volumen de esta
 * herramienta interna una caché de proceso (que se vacía al reiniciar el
 * servidor) es suficiente.
 */
export function crearCache<T>(ttlMs: number = CACHE_TTL_MS): Cache<T> {
  const almacen = new Map<string, { datos: T; expira: number }>();

  return {
    leer(clave: string, ahora: number = Date.now()): T | null {
      const entrada = almacen.get(clave);
      if (!entrada) {
        return null;
      }
      if (ahora > entrada.expira) {
        almacen.delete(clave);
        return null;
      }
      return entrada.datos;
    },

    guardar(clave: string, datos: T, ahora: number = Date.now()): void {
      almacen.set(clave, { datos, expira: ahora + ttlMs });
    },
  };
}
