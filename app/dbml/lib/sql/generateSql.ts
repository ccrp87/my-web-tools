import type { DbmlColumn, DbmlEnum, DbmlRef, DbmlRefEndpoint, DbmlSchema, DbmlTable } from "../parser/types";

export type SqlDialect = "postgres" | "mysql" | "sqlserver";

const SAFE_IDENTIFIER_PATTERN: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(name: string, dialect: SqlDialect): string {
  if (SAFE_IDENTIFIER_PATTERN.test(name)) return name;
  if (dialect === "mysql") return `\`${name.replace(/`/g, "``")}\``;
  return `"${name.replace(/"/g, '""')}"`;
}

function sanitizeConstraintName(name: string): string {
  const sanitized: string = name.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[0-9]/.test(sanitized) ? `_${sanitized}` : sanitized;
}

function isIntegerType(type: string): boolean {
  return /\b(int|integer|bigint|smallint)\b/i.test(type);
}

function isBigIntType(type: string): boolean {
  return /big/i.test(type);
}

/** Si el valor viene entre backticks (expresión SQL, p. ej. `now()`), la devuelve sin las backticks; si no, null. */
function extractBacktickExpression(value: string): string | null {
  const trimmed: string = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1);
  }
  return null;
}

function escapeSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function formatDefaultValue(rawValue: string): string {
  const expression: string | null = extractBacktickExpression(rawValue);
  if (expression !== null) return expression;
  if (/^-?\d+(\.\d+)?$/.test(rawValue) || rawValue === "true" || rawValue === "false") {
    return rawValue;
  }
  return `'${escapeSingleQuoted(rawValue)}'`;
}

function findEnumForType(type: string, enums: readonly DbmlEnum[]): DbmlEnum | undefined {
  return enums.find((enumDef) => enumDef.name === type);
}

interface ColumnTypeSql {
  typeSql: string;
  incrementSuffix: string;
}

function resolveColumnType(
  column: DbmlColumn,
  dialect: SqlDialect,
  enums: readonly DbmlEnum[],
): ColumnTypeSql {
  const matchingEnum: DbmlEnum | undefined = findEnumForType(column.type, enums);

  if (matchingEnum) {
    if (dialect === "mysql") {
      const values: string = matchingEnum.values.map((v) => `'${escapeSingleQuoted(v)}'`).join(", ");
      return { typeSql: `ENUM(${values})`, incrementSuffix: "" };
    }
    if (dialect === "sqlserver") {
      return { typeSql: "NVARCHAR(255)", incrementSuffix: "" };
    }
    // postgres: el tipo ya es el nombre del enum, creado aparte con CREATE TYPE.
    return { typeSql: column.type, incrementSuffix: "" };
  }

  if (column.isIncrement && isIntegerType(column.type)) {
    if (dialect === "postgres") {
      return { typeSql: isBigIntType(column.type) ? "BIGSERIAL" : "SERIAL", incrementSuffix: "" };
    }
    if (dialect === "mysql") {
      return { typeSql: column.type, incrementSuffix: " AUTO_INCREMENT" };
    }
    return { typeSql: column.type, incrementSuffix: " IDENTITY(1,1)" };
  }

  return { typeSql: column.type, incrementSuffix: "" };
}

function resolveColumnConstraints(
  column: DbmlColumn,
  dialect: SqlDialect,
  enums: readonly DbmlEnum[],
  quotedColumnName: string,
): string {
  const parts: string[] = [];
  if (column.isPrimaryKey) parts.push("PRIMARY KEY");
  if (column.isNotNull && !column.isPrimaryKey) parts.push("NOT NULL");
  if (column.isUnique && !column.isPrimaryKey) parts.push("UNIQUE");
  if (column.defaultValue !== null) parts.push(`DEFAULT ${formatDefaultValue(column.defaultValue)}`);

  const matchingEnum: DbmlEnum | undefined = findEnumForType(column.type, enums);
  if (matchingEnum && dialect === "sqlserver") {
    const values: string = matchingEnum.values.map((v) => `'${escapeSingleQuoted(v)}'`).join(", ");
    parts.push(`CHECK (${quotedColumnName} IN (${values}))`);
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function serializeColumnLine(
  column: DbmlColumn,
  dialect: SqlDialect,
  enums: readonly DbmlEnum[],
): string {
  const quotedName: string = quoteIdentifier(column.name, dialect);
  const { typeSql, incrementSuffix } = resolveColumnType(column, dialect, enums);
  const constraints: string = resolveColumnConstraints(column, dialect, enums, quotedName);
  return `  ${quotedName} ${typeSql}${incrementSuffix}${constraints}`;
}

function serializeCreateTable(
  table: DbmlTable,
  dialect: SqlDialect,
  enums: readonly DbmlEnum[],
): string {
  const quotedName: string = quoteIdentifier(table.name, dialect);
  const columnLines: string = table.columns.map((column) => serializeColumnLine(column, dialect, enums)).join(",\n");
  return `CREATE TABLE ${quotedName} (\n${columnLines}\n);`;
}

function serializeEnumType(enumDef: DbmlEnum, dialect: SqlDialect): string {
  const quotedName: string = quoteIdentifier(enumDef.name, dialect);
  const values: string = enumDef.values.map((v) => `'${escapeSingleQuoted(v)}'`).join(", ");
  return `CREATE TYPE ${quotedName} AS ENUM (${values});`;
}

interface ForeignKeyEndpoints {
  child: DbmlRefEndpoint;
  parent: DbmlRefEndpoint;
}

/**
 * Decide qué extremo de la relación es la "tabla hija" que debe llevar la
 * FK. Si ambos extremos son "muchos" (muchos-a-muchos), no hay un lado
 * natural para la FK sin una tabla intermedia, así que no se genera.
 */
function resolveForeignKeyEndpoints(ref: DbmlRef): ForeignKeyEndpoints | null {
  if (ref.left.cardinality === "many" && ref.right.cardinality === "one") {
    return { child: ref.left, parent: ref.right };
  }
  if (ref.left.cardinality === "one" && ref.right.cardinality === "many") {
    return { child: ref.right, parent: ref.left };
  }
  if (ref.left.cardinality === "one" && ref.right.cardinality === "one") {
    return { child: ref.left, parent: ref.right };
  }
  return null;
}

function serializeRefStatement(ref: DbmlRef, dialect: SqlDialect): string {
  const endpoints: ForeignKeyEndpoints | null = resolveForeignKeyEndpoints(ref);
  if (!endpoints) {
    return `-- Relación muchos-a-muchos entre ${ref.left.table}.${ref.left.column} y ${ref.right.table}.${ref.right.column}: requiere tabla intermedia, no generada.`;
  }

  const { child, parent } = endpoints;
  const constraintName: string = quoteIdentifier(
    sanitizeConstraintName(`fk_${child.table}_${child.column}`),
    dialect,
  );
  const childTable: string = quoteIdentifier(child.table, dialect);
  const childColumn: string = quoteIdentifier(child.column, dialect);
  const parentTable: string = quoteIdentifier(parent.table, dialect);
  const parentColumn: string = quoteIdentifier(parent.column, dialect);

  return `ALTER TABLE ${childTable} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${childColumn}) REFERENCES ${parentTable} (${parentColumn});`;
}

/**
 * Genera SQL de referencia (no un motor de migración) a partir del
 * esquema DBML ya parseado, para los tres dialectos más comunes.
 */
export function generateSql(schema: DbmlSchema, dialect: SqlDialect): string {
  const sections: string[] = [];

  if (dialect === "postgres" && schema.enums.length > 0) {
    sections.push(schema.enums.map((enumDef) => serializeEnumType(enumDef, dialect)).join("\n"));
  }

  if (schema.tables.length > 0) {
    sections.push(
      schema.tables.map((table) => serializeCreateTable(table, dialect, schema.enums)).join("\n\n"),
    );
  }

  if (schema.refs.length > 0) {
    sections.push(schema.refs.map((ref) => serializeRefStatement(ref, dialect)).join("\n"));
  }

  return sections.length > 0 ? `${sections.join("\n\n")}\n` : "";
}
