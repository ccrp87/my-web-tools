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
  /**
   * Categoría más específica que reporta la propia tienda (ej. "Aceites",
   * "Enlatados y conservas"). Cada adaptador la extrae de su propia
   * taxonomía — no hay un catálogo único homologado entre tiendas, cada una
   * usa nombres distintos — pero el campo en sí es consistente: siempre la
   * hoja más específica del árbol de categorías de esa tienda. Sirve para
   * que el usuario filtre manualmente resultados con las palabras correctas
   * pero de una categoría distinta (ej. "atún en aceite de oliva" al buscar
   * "aceite oliva").
   */
  categoria?: string;
}

export interface RespuestaTienda {
  tienda: string;
  resultados: Resultado[];
  error?: string;
}
