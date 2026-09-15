import type { Adaptador } from "./tipos";
import { esErrorDeTimeout } from "./http";
import { crearAdaptadorInstaleap, obtenerConFetch } from "./instaleap";

/**
 * tienda.makro.com.co corre sobre la misma plataforma Instaleap que La
 * Economía (mismo esquema de producto, mismo truco de `RSC: 1`), pero a
 * diferencia de esa tienda sí envía su cadena TLS completa, así que no
 * necesita el workaround de certificado intermedio: alcanza con el fetch
 * compartido (`fetchConTimeout`).
 */
export function crearAdaptadorMakro(): Adaptador {
  return crearAdaptadorInstaleap({
    tienda: "Makro",
    origen: "https://tienda.makro.com.co",
    obtener: obtenerConFetch,
    esTimeout: esErrorDeTimeout,
  });
}
