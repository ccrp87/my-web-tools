export type DbmlTokenType =
  | "comment"
  | "string"
  | "keyword"
  | "attribute"
  | "type"
  | "name"
  | "number"
  | "punctuation"
  | "plain";

export interface DbmlToken {
  type: DbmlTokenType;
  text: string;
}

const BLOCK_KEYWORDS: ReadonlySet<string> = new Set(["Table", "Enum", "TableGroup"]);

const TYPE_KEYWORDS: ReadonlySet<string> = new Set([
  "integer",
  "int",
  "bigint",
  "smallint",
  "tinyint",
  "varchar",
  "char",
  "character",
  "text",
  "boolean",
  "bool",
  "decimal",
  "numeric",
  "float",
  "double",
  "real",
  "date",
  "datetime",
  "timestamp",
  "timestamptz",
  "time",
  "uuid",
  "json",
  "jsonb",
  "serial",
  "bigserial",
  "blob",
  "binary",
  "money",
]);

/**
 * Comentarios y cadenas van primero (para que una palabra clave dentro de
 * ellos no se coloree como tal). Identificadores y espacios en blanco se
 * capturan como alternativas propias (no como "lo que sobra entre
 * coincidencias") para que el segundo paso pueda reconocer con precisión
 * "el identificador que sigue a Table/Enum/TableGroup/as" y "el
 * identificador seguido de un punto" como nombres de tabla.
 */
const TOKEN_PATTERN: RegExp = new RegExp(
  [
    /(\/\/[^\n]*)/.source,
    /(\/\*[\s\S]*?\*\/)/.source,
    /('(?:[^'\\]|\\.)*')/.source,
    /("(?:[^"\\]|\\.)*")/.source,
    /(`[^`]*`)/.source,
    /\b(Table|Ref|Enum|TableGroup|Project|Note|Indexes|as)\b/.source,
    `\\b(${[...TYPE_KEYWORDS].join("|")})\\b`,
    /\b(primary key|not null|headercolor|increment|unique|default|color|note|null|ref|pk)\b/.source,
    /(-?\b\d+(?:\.\d+)?\b)/.source,
    /([A-Za-z_][A-Za-z0-9_]*)/.source,
    /([{}[\]().,:<>-])/.source,
    /(\s+)/.source,
  ].join("|"),
  "g",
);

interface RawToken {
  type: DbmlTokenType | "identifier" | "whitespace";
  text: string;
}

function tokenizeRaw(source: string): RawToken[] {
  const tokens: RawToken[] = [];
  let lastIndex: number = 0;
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "plain", text: source.slice(lastIndex, match.index) });
    }

    const [
      fullMatch,
      lineComment,
      blockComment,
      singleQuoted,
      doubleQuoted,
      backtickQuoted,
      keyword,
      type,
      attribute,
      number,
      identifier,
      punctuation,
      whitespace,
    ] = match;

    let tokenType: RawToken["type"] = "plain";
    if (lineComment || blockComment) tokenType = "comment";
    else if (singleQuoted || doubleQuoted || backtickQuoted) tokenType = "string";
    else if (keyword) tokenType = "keyword";
    else if (type) tokenType = "type";
    else if (attribute) tokenType = "attribute";
    else if (number) tokenType = "number";
    else if (identifier) tokenType = "identifier";
    else if (punctuation) tokenType = "punctuation";
    else if (whitespace) tokenType = "whitespace";

    tokens.push({ type: tokenType, text: fullMatch });
    lastIndex = TOKEN_PATTERN.lastIndex;
  }

  if (lastIndex < source.length) {
    tokens.push({ type: "plain", text: source.slice(lastIndex) });
  }

  return tokens;
}

function nextSignificantIndex(tokens: readonly RawToken[], fromIndex: number): number | null {
  for (let i = fromIndex; i < tokens.length; i += 1) {
    if (tokens[i].type !== "whitespace") return i;
  }
  return null;
}

/**
 * Marca como "name" (nombre de tabla) el identificador o cadena que sigue
 * a `Table`/`Enum`/`TableGroup`/`as`, y también cualquier identificador o
 * cadena seguido de un punto (p. ej. `posts` en `posts.user_id`), que en
 * DBML siempre es una referencia a una tabla.
 */
function markTableNames(tokens: RawToken[]): void {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === "keyword" && (BLOCK_KEYWORDS.has(token.text) || token.text === "as")) {
      const nameIndex = nextSignificantIndex(tokens, i + 1);
      if (nameIndex !== null && (tokens[nameIndex].type === "identifier" || tokens[nameIndex].type === "string")) {
        tokens[nameIndex].type = "name";
      }
      continue;
    }

    if (token.type === "identifier" || token.type === "string") {
      const nextIndex = nextSignificantIndex(tokens, i + 1);
      if (nextIndex !== null && tokens[nextIndex].type === "punctuation" && tokens[nextIndex].text === ".") {
        token.type = "name";
      }
    }
  }
}

export function tokenizeDbml(source: string): DbmlToken[] {
  const rawTokens = tokenizeRaw(source);
  markTableNames(rawTokens);

  return rawTokens.map((token) => ({
    type: token.type === "identifier" || token.type === "whitespace" ? "plain" : token.type,
    text: token.text,
  }));
}
