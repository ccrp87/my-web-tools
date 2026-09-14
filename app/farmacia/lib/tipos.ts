export interface Resultado {
  tienda: string;
  nombre: string;
  precio: number | null;
  disponible: boolean;
  url?: string;
  marca?: string;
  imagen?: string;
}

export interface RespuestaTienda {
  tienda: string;
  resultados: Resultado[];
  error?: string;
}
