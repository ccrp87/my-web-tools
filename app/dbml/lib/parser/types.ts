export interface DbmlColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
  isIncrement: boolean;
  isForeignKey: boolean;
  defaultValue: string | null;
  note: string | null;
}

export interface DbmlTable {
  name: string;
  alias: string | null;
  note: string | null;
  headerColor: string | null;
  columns: DbmlColumn[];
}

export type DbmlCardinality = "one" | "many";

export interface DbmlRefEndpoint {
  table: string;
  column: string;
  cardinality: DbmlCardinality;
}

export interface DbmlRef {
  left: DbmlRefEndpoint;
  right: DbmlRefEndpoint;
}

export interface DbmlEnum {
  name: string;
  values: string[];
}

export interface DbmlTableGroup {
  name: string;
  color: string | null;
  /** Nombres de las tablas miembro, en el orden en que aparecen en el bloque. */
  tables: string[];
}

export interface DbmlSchema {
  tables: DbmlTable[];
  refs: DbmlRef[];
  enums: DbmlEnum[];
  tableGroups: DbmlTableGroup[];
  warnings: string[];
}

export interface DbmlParseError {
  message: string;
  line: number;
}

export type DbmlParseResult =
  | { ok: true; schema: DbmlSchema }
  | { ok: false; error: DbmlParseError };

/** Símbolo de cardinalidad DBML entre dos extremos de una relación. */
export type RefSymbol = "<" | ">" | "-" | "<>";

/**
 * Mapea el símbolo de una relación a la cardinalidad de cada extremo.
 * `>` es "muchos-a-uno" (izquierda = muchos, derecha = uno), `<` es su
 * inverso, `-` es uno-a-uno y `<>` es muchos-a-muchos.
 */
export function cardinalitiesForSymbol(
  symbol: RefSymbol,
): [DbmlCardinality, DbmlCardinality] {
  switch (symbol) {
    case ">":
      return ["many", "one"];
    case "<":
      return ["one", "many"];
    case "-":
      return ["one", "one"];
    case "<>":
      return ["many", "many"];
  }
}
