import type {
  DbmlCardinality,
  DbmlColumn,
  DbmlEnum,
  DbmlRef,
  DbmlSchema,
  DbmlTable,
  DbmlTableGroup,
  RefSymbol,
} from "../parser/types";

const SAFE_IDENTIFIER_PATTERN: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIfNeeded(name: string): string {
  return SAFE_IDENTIFIER_PATTERN.test(name) ? name : `"${name.replace(/"/g, '\\"')}"`;
}

function escapeSingleQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function serializeColumnSettings(column: DbmlColumn): string {
  const parts: string[] = [];
  if (column.isPrimaryKey) parts.push("pk");
  if (column.isNotNull) parts.push("not null");
  if (column.isUnique) parts.push("unique");
  if (column.isIncrement) parts.push("increment");
  if (column.defaultValue !== null) {
    parts.push(`default: '${escapeSingleQuoted(column.defaultValue)}'`);
  }
  if (column.note !== null) {
    parts.push(`note: '${escapeSingleQuoted(column.note)}'`);
  }
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

function serializeColumn(column: DbmlColumn): string {
  return `  ${quoteIfNeeded(column.name)} ${column.type}${serializeColumnSettings(column)}`;
}

function serializeTableSettings(table: DbmlTable): string {
  const parts: string[] = [];
  if (table.headerColor !== null) parts.push(`headercolor: ${table.headerColor}`);
  if (table.note !== null) parts.push(`note: '${escapeSingleQuoted(table.note)}'`);
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

function serializeTable(table: DbmlTable): string {
  const alias: string = table.alias ? ` as ${quoteIfNeeded(table.alias)}` : "";
  const header = `Table ${quoteIfNeeded(table.name)}${alias}${serializeTableSettings(table)} {`;
  return [header, ...table.columns.map(serializeColumn), "}"].join("\n");
}

/** Inversa de `cardinalitiesForSymbol`: a partir de la cardinalidad de cada extremo, recupera el símbolo DBML. */
export function symbolForCardinalities(
  left: DbmlCardinality,
  right: DbmlCardinality,
): RefSymbol {
  if (left === "many" && right === "one") return ">";
  if (left === "one" && right === "many") return "<";
  if (left === "one" && right === "one") return "-";
  return "<>";
}

function serializeRef(ref: DbmlRef): string {
  const symbol: RefSymbol = symbolForCardinalities(ref.left.cardinality, ref.right.cardinality);
  const left = `${quoteIfNeeded(ref.left.table)}.${quoteIfNeeded(ref.left.column)}`;
  const right = `${quoteIfNeeded(ref.right.table)}.${quoteIfNeeded(ref.right.column)}`;
  return `Ref: ${left} ${symbol} ${right}`;
}

function serializeEnum(enumDef: DbmlEnum): string {
  const valueLines = enumDef.values.map((value) => `  ${quoteIfNeeded(value)}`);
  return [`Enum ${quoteIfNeeded(enumDef.name)} {`, ...valueLines, "}"].join("\n");
}

function serializeTableGroupSettings(tableGroup: DbmlTableGroup): string {
  return tableGroup.color !== null ? ` [color: ${tableGroup.color}]` : "";
}

function serializeTableGroup(tableGroup: DbmlTableGroup): string {
  const header = `TableGroup ${quoteIfNeeded(tableGroup.name)}${serializeTableGroupSettings(tableGroup)} {`;
  const memberLines = tableGroup.tables.map((tableName) => `  ${quoteIfNeeded(tableName)}`);
  return [header, ...memberLines, "}"].join("\n");
}

/**
 * Reconstruye el texto DBML a partir del modelo de datos. Se usa para
 * aplicar ediciones estructuradas (renombrar una tabla, cambiar el tipo de
 * una columna, etc.): se parte del esquema ya parseado, se modifica el
 * objeto, y se vuelve a serializar en vez de parchear el texto original.
 * Esto reformatea el código (no preserva comentarios ni el estilo exacto
 * del usuario), a cambio de una edición estructurada confiable.
 */
export function serializeDbml(schema: DbmlSchema): string {
  const sections: string[] = [];

  if (schema.tables.length > 0) {
    sections.push(schema.tables.map(serializeTable).join("\n\n"));
  }
  if (schema.refs.length > 0) {
    sections.push(schema.refs.map(serializeRef).join("\n"));
  }
  if (schema.enums.length > 0) {
    sections.push(schema.enums.map(serializeEnum).join("\n\n"));
  }
  if (schema.tableGroups.length > 0) {
    sections.push(schema.tableGroups.map(serializeTableGroup).join("\n\n"));
  }

  return sections.length > 0 ? `${sections.join("\n\n")}\n` : "";
}
