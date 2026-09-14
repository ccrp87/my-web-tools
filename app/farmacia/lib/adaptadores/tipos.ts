import type { RespuestaTienda } from "../tipos";

export interface Adaptador {
  tienda: string;
  buscar(termino: string, limite: number): Promise<RespuestaTienda>;
}
