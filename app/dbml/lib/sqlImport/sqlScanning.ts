/**
 * Utilidades de bajo nivel para escanear DDL SQL sin un parser completo:
 * saber qué está "dentro de comillas" o "dentro de paréntesis" es lo único
 * que necesitamos para no cortar mal al separar sentencias o columnas.
 * Cubre las 4 formas de comillas de identificador de los dialectos
 * soportados (`backtick`, "ansi", [corchetes]) más la cadena 'simple'.
 */

const CLOSING_QUOTE_FOR: Record<string, string> = {
  "'": "'",
  '"': '"',
  "`": "`",
  "[": "]",
};

/**
 * Quita comentarios `-- ...`, `# ...` (dialectos tipo MySQL) y `/* ... *\/`
 * sin tratarlos como tales dentro de comillas. Sustituye por espacios/saltos
 * de línea para no desplazar el resto del texto.
 */
export function stripSqlComments(source: string, dialect: "mysql" | "mariadb" | "postgres" | "sqlserver"): string {
  let result: string = "";
  let quote: string | null = null;
  let i: number = 0;

  while (i < source.length) {
    const char = source[i];

    if (quote) {
      result += char;
      if (char === quote) {
        if (source[i + 1] === quote) {
          result += source[i + 1];
          i += 2;
          continue;
        }
        quote = null;
      }
      i += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      result += char;
      i += 1;
      continue;
    }
    if (char === "[") {
      quote = "]";
      result += char;
      i += 1;
      continue;
    }

    if (char === "-" && source[i + 1] === "-") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    if ((dialect === "mysql" || dialect === "mariadb") && char === "#") {
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

/**
 * Separa `text` por las apariciones de `separator` que están al nivel
 * "superior": fuera de comillas y fuera de paréntesis. Sirve tanto para
 * partir un script en sentencias (separador `;`) como para partir la lista
 * de columnas de un `CREATE TABLE` (separador `,`).
 */
export function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth: number = 0;
  let quote: string | null = null;
  let start: number = 0;
  let i: number = 0;

  while (i < text.length) {
    const char = text[i];

    if (quote) {
      if (char === quote) {
        if (text[i + 1] === quote) {
          i += 2;
          continue;
        }
        quote = null;
      }
      i += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      i += 1;
      continue;
    }
    if (char === "[") {
      quote = "]";
      i += 1;
      continue;
    }

    if (char === "(") {
      depth += 1;
      i += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }

    if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(start, i));
      i += separator.length;
      start = i;
      continue;
    }

    i += 1;
  }

  parts.push(text.slice(start));
  return parts;
}

/**
 * Busca el índice del `)` que cierra el `(` en `openIndex`, respetando
 * anidamiento y comillas. Devuelve `null` si el texto está mal formado.
 */
export function findMatchingParen(text: string, openIndex: number): number | null {
  let depth: number = 0;
  let quote: string | null = null;

  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];

    if (quote) {
      if (char === quote) {
        if (text[i + 1] === quote) {
          i += 1;
          continue;
        }
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") {
      quote = "]";
      continue;
    }

    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return null;
}

export function skipWhitespace(text: string, index: number): number {
  let i: number = index;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}

export interface SqlToken {
  value: string;
  nextIndex: number;
}

/** Lee un identificador en cualquiera de las 4 formas de comillado, o uno sin comillas. */
export function readSqlIdentifier(text: string, index: number): SqlToken | null {
  const char = text[index];
  const closing = char ? CLOSING_QUOTE_FOR[char] : undefined;

  if (closing && char !== "'") {
    let i: number = index + 1;
    let value: string = "";
    while (i < text.length) {
      if (text[i] === closing) {
        if (text[i + 1] === closing) {
          value += closing;
          i += 2;
          continue;
        }
        return { value, nextIndex: i + 1 };
      }
      value += text[i];
      i += 1;
    }
    return null;
  }

  const match: RegExpExecArray | null = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(text.slice(index));
  if (!match) return null;
  return { value: match[0], nextIndex: index + match[0].length };
}

/** Como `readSqlIdentifier`, pero resuelve calificación por esquema (`esquema.tabla` → `tabla`). */
export function readQualifiedIdentifier(text: string, index: number): SqlToken | null {
  const start: number = skipWhitespace(text, index);
  const first = readSqlIdentifier(text, start);
  if (!first) return null;

  let value: string = first.value;
  let i: number = first.nextIndex;
  while (text[i] === ".") {
    const next = readSqlIdentifier(text, i + 1);
    if (!next) break;
    value = next.value;
    i = next.nextIndex;
  }
  return { value, nextIndex: i };
}

/** Lee una cadena `'...'` (comillas dobles `''` = comilla literal) a partir de index (debe apuntar a la `'`). */
export function readSqlStringLiteral(text: string, index: number): SqlToken | null {
  if (text[index] !== "'") return null;
  let i: number = index + 1;
  let value: string = "";
  while (i < text.length) {
    if (text[i] === "'") {
      if (text[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      return { value, nextIndex: i + 1 };
    }
    value += text[i];
    i += 1;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const KEYWORD_PATTERN_CACHE = new Map<string, RegExp>();

/**
 * Intenta hacer coincidir una palabra clave (sin distinguir mayúsculas, y
 * tolerando cualquier cantidad de espacio entre palabras: "PRIMARY KEY",
 * "GENERATED ALWAYS AS IDENTITY") en `index`, exigiendo que no continúe con
 * otro carácter de identificador. Devuelve el índice siguiente, o `null` si
 * no coincide.
 */
export function matchKeyword(text: string, index: number, keyword: string): number | null {
  const start: number = skipWhitespace(text, index);

  let pattern: RegExp | undefined = KEYWORD_PATTERN_CACHE.get(keyword);
  if (!pattern) {
    const body: string = keyword.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
    pattern = new RegExp(`^(?:${body})(?![A-Za-z0-9_])`, "i");
    KEYWORD_PATTERN_CACHE.set(keyword, pattern);
  }

  const match: RegExpExecArray | null = pattern.exec(text.slice(start));
  return match ? start + match[0].length : null;
}
