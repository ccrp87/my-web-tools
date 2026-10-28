/** Calcula el número de línea (1-indexado) correspondiente a un índice del texto. */
export function lineNumberAt(text: string, index: number): number {
  let line: number = 1;
  const limit: number = Math.min(index, text.length);
  for (let i = 0; i < limit; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

const WHITESPACE_PATTERN = /\s/;

/** Avanza el índice saltando espacios en blanco (incluye saltos de línea). */
export function skipWhitespace(text: string, index: number): number {
  let i: number = index;
  while (i < text.length && WHITESPACE_PATTERN.test(text[i])) i += 1;
  return i;
}

const IDENTIFIER_START_PATTERN = /[A-Za-z_]/;
const IDENTIFIER_PART_PATTERN = /[A-Za-z0-9_]/;

export interface TokenResult {
  value: string;
  nextIndex: number;
}

/** Lee un identificador simple o una cadena entre comillas dobles. */
export function readNameToken(text: string, index: number): TokenResult | null {
  if (text[index] === '"') {
    let i: number = index + 1;
    while (i < text.length) {
      if (text[i] === '"' && text[i - 1] !== "\\") {
        return { value: text.slice(index + 1, i), nextIndex: i + 1 };
      }
      i += 1;
    }
    return null;
  }

  if (!IDENTIFIER_START_PATTERN.test(text[index] ?? "")) return null;

  let i: number = index + 1;
  while (i < text.length && IDENTIFIER_PART_PATTERN.test(text[i])) i += 1;
  return { value: text.slice(index, i), nextIndex: i };
}

/**
 * Lee un nombre posiblemente calificado por esquema (`esquema.tabla`) y
 * devuelve solo el último segmento, que es el nombre real que usamos
 * (no modelamos múltiples esquemas).
 */
export function readQualifiedName(text: string, index: number): TokenResult | null {
  const first = readNameToken(text, index);
  if (!first) return null;

  let value: string = first.value;
  let i: number = first.nextIndex;
  while (text[i] === "." ) {
    const next = readNameToken(text, i + 1);
    if (!next) break;
    value = next.value;
    i = next.nextIndex;
  }
  return { value, nextIndex: i };
}

/**
 * Busca el índice de cierre correspondiente al carácter de apertura en
 * `openIndex`, respetando anidamiento y comillas (comillas escapadas con
 * `\` no cuentan como cierre de la comilla).
 */
export function findMatchingBrace(
  text: string,
  openIndex: number,
  openChar: string = "{",
  closeChar: string = "}",
): number | null {
  let depth: number = 0;
  let quote: string | null = null;

  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];

    if (quote) {
      if (char === quote && text[i - 1] !== "\\") quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return null;
}

/**
 * Lee el resto de la "línea lógica" actual: avanza hasta un salto de
 * línea que no esté dentro de corchetes `[...]` ni comillas, para que
 * valores de `default:`/`note:` con comas o corchetes dentro de comillas
 * no corten la línea antes de tiempo.
 */
export function readLogicalLine(text: string, index: number): TokenResult {
  let i: number = index;
  let bracketDepth: number = 0;
  let quote: string | null = null;

  while (i < text.length) {
    const char = text[i];

    if (quote) {
      if (char === quote && text[i - 1] !== "\\") quote = null;
      i += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      i += 1;
      continue;
    }

    if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "\n" && bracketDepth === 0) break;

    i += 1;
  }

  return { value: text.slice(index, i), nextIndex: i };
}
