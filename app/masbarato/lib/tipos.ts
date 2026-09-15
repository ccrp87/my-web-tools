import type { Presentacion } from "./presentacion";

export interface Resultado {
  tienda: string;
  nombre: string;
  precio: number | null;
  disponible: boolean;
  url?: string;
  marca?: string;
  imagen?: string;
  /** Presentación reportada por la propia tienda (ej. PUM de VTEX), más confiable que adivinarla del nombre. */
  presentacion?: Presentacion;
}

export interface RespuestaTienda {
  tienda: string;
  resultados: Resultado[];
  error?: string;
}
