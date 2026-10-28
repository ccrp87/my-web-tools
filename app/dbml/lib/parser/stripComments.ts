/**
 * Quita comentarios `// ...` (hasta fin de línea) y `/* ... *\/` (puede
 * cruzar líneas) de un texto DBML, sin tratarlos como comentario si
 * aparecen dentro de comillas. El contenido removido se reemplaza por
 * espacios (o saltos de línea, si el original los tenía) en vez de
 * borrarse, para que los números de línea de errores posteriores sobre
 * el texto resultante sigan coincidiendo con el texto original.
 */
export function stripComments(source: string): string {
  let result: string = "";
  let quote: string | null = null;
  let i: number = 0;

  while (i < source.length) {
    const char = source[i];

    if (quote) {
      result += char;
      if (char === quote && source[i - 1] !== "\\") quote = null;
      i += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      result += char;
      i += 1;
      continue;
    }

    if (char === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    if (char === "/" && source[i + 1] === "*") {
      const end: number = source.indexOf("*/", i + 2);
      const stop: number = end === -1 ? source.length : end + 2;
      for (let j = i; j < stop; j += 1) {
        result += source[j] === "\n" ? "\n" : " ";
      }
      i = stop;
      continue;
    }

    result += char;
    i += 1;
  }

  return result;
}
