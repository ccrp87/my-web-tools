import type { RespuestaTienda } from "../tipos";

export interface OpcionesBusqueda {
  /**
   * Cada adaptador filtra localmente los resultados que no contienen todas
   * las palabras significativas del término (ver `esRelevante` en cada
   * adaptador) porque el buscador remoto (Algolia, autocompletado, etc.)
   * puede aflojar la búsqueda y devolver productos sin relación real. Ese
   * filtro exige coincidencia de texto literal, así que también descarta
   * coincidencias genuinas con otra forma (género/número/sinónimo: "paños
   * húmedos" vs. "Toallitas Húmedas").
   *
   * Con `crudo: true` el adaptador se salta ese filtro y devuelve los
   * candidatos tal cual los ordenó la tienda: pensado para el modo de
   * búsqueda con IA, donde el cliente hace su propio filtrado por
   * similitud semántica en vez de coincidencia de texto exacta.
   */
  crudo?: boolean;
}

export interface Adaptador {
  tienda: string;
  buscar(
    termino: string,
    limite: number,
    opciones?: OpcionesBusqueda,
  ): Promise<RespuestaTienda>;
}
