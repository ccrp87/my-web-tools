/**
 * Ancho promedio de un carácter como fracción del tamaño de fuente, para
 * fuentes sans-serif típicas. Es una aproximación deliberada: el layout
 * debe ser una función pura (sin medir texto real en el DOM/canvas) para
 * poder calcularse antes de montar cualquier componente y para que sea
 * testeable sin un navegador.
 */
const AVERAGE_CHAR_WIDTH_RATIO: number = 0.56;

export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * AVERAGE_CHAR_WIDTH_RATIO;
}
