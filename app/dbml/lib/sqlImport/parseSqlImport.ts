import type { DbmlColumn, DbmlEnum, DbmlRef, DbmlSchema, DbmlTable } from "../parser/types";
import {
  findMatchingParen,
  matchKeyword,
  readQualifiedIdentifier,
  readSqlIdentifier,
  readSqlStringLiteral,
  skipWhitespace,
  splitTopLevel,
  stripSqlComments,
} from "./sqlScanning";
import type { SqlImportDialect, SqlImportResult } from "./types";

const COLUMN_STOP_WORDS = new Set([
  "PRIMARY",
  "NOT",
  "NULL",
  "UNIQUE",
  "DEFAULT",
  "AUTO_INCREMENT",
  "AUTOINCREMENT",
  "IDENTITY",
  "GENERATED",
  "REFERENCES",
  "CHECK",
  "COLLATE",
  "COMMENT",
]);

function dequoteListItem(raw: string): string {
  const trimmed: string = raw.trim();
  const stringToken = readSqlStringLiteral(trimmed, 0);
  if (stringToken) return stringToken.value;
  const identToken = readSqlIdentifier(trimmed, 0);
  return identToken ? identToken.value : trimmed;
}

/** Reconoce el patrón `col IN ('a','b')` usado para emular enums sin tipo ENUM nativo (p. ej. SQL Server). */
function tryExtractCheckEnumValues(expression: string, columnName: string): string[] | null {
  const match: RegExpExecArray | null =
    /^\s*(?:`([^`]+)`|"([^"]+)"|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))\s+IN\s*\(([\s\S]*)\)\s*$/i.exec(
      expression,
    );
  if (!match) return null;

  const checkedColumn: string = match[1] ?? match[2] ?? match[3] ?? match[4];
  if (checkedColumn.toLowerCase() !== columnName.toLowerCase()) return null;

  const values: string[] = splitTopLevel(match[5], ",").map(dequoteListItem).filter((v) => v.length > 0);
  return values.length > 0 ? values : null;
}

interface ParsedColumnClause {
  column: DbmlColumn;
  inlineForeignKey: { targetTable: string; targetColumn: string } | null;
  enumValues: string[] | null;
}

function parseColumnType(clause: string, afterNameIndex: number): { type: string; nextIndex: number } {
  const typeParts: string[] = [];
  let i: number = afterNameIndex;

  while (true) {
    const j: number = skipWhitespace(clause, i);
    const wordMatch: RegExpExecArray | null = /^[A-Za-z_][A-Za-z0-9_]*/.exec(clause.slice(j));
    if (!wordMatch) break;
    if (COLUMN_STOP_WORDS.has(wordMatch[0].toUpperCase())) {
      i = j;
      break;
    }

    let part: string = wordMatch[0];
    let end: number = j + wordMatch[0].length;
    const afterWord: number = skipWhitespace(clause, end);
    if (clause[afterWord] === "(") {
      const close: number | null = findMatchingParen(clause, afterWord);
      if (close !== null) {
        part += clause.slice(afterWord, close + 1);
        end = close + 1;
      }
    }
    typeParts.push(part);
    i = end;
  }

  return { type: typeParts.join(" ") || "varchar", nextIndex: i };
}

/** Parsea `DEFAULT <valor>`, decidiendo si es literal o expresión (se envuelve en backticks, igual que el parser DBML). */
function parseDefaultValue(clause: string, index: number): { value: string; nextIndex: number } {
  const k: number = skipWhitespace(clause, index);

  if (clause[k] === "'") {
    const stringToken = readSqlStringLiteral(clause, k);
    if (stringToken) return { value: stringToken.value, nextIndex: stringToken.nextIndex };
  }

  if (clause[k] === "(") {
    const close: number | null = findMatchingParen(clause, k);
    if (close !== null) {
      return { value: `\`${clause.slice(k + 1, close).trim()}\``, nextIndex: close + 1 };
    }
  }

  const wordMatch: RegExpExecArray | null = /^[+-]?[A-Za-z0-9_.]+/.exec(clause.slice(k));
  if (wordMatch) {
    let word: string = wordMatch[0];
    let end: number = k + word.length;
    if (clause[end] === "(") {
      const close: number | null = findMatchingParen(clause, end);
      if (close !== null) {
        word += clause.slice(end, close + 1);
        end = close + 1;
      }
    }
    const isLiteral: boolean = /^[+-]?\d+(\.\d+)?$/.test(word) || /^(true|false)$/i.test(word);
    return { value: isLiteral ? word : `\`${word}\``, nextIndex: end };
  }

  return { value: "", nextIndex: k };
}

/** Avanza sobre un token no reconocido (palabra, cadena o grupo entre paréntesis) para no quedar en bucle infinito. */
function skipUnknownToken(clause: string, index: number): number {
  if (clause[index] === "(") {
    const close: number | null = findMatchingParen(clause, index);
    return close !== null ? close + 1 : index + 1;
  }
  if (clause[index] === "'") {
    const stringToken = readSqlStringLiteral(clause, index);
    return stringToken ? stringToken.nextIndex : index + 1;
  }
  const wordMatch: RegExpExecArray | null = /^[A-Za-z0-9_]+/.exec(clause.slice(index));
  return wordMatch ? index + wordMatch[0].length : index + 1;
}

function parseColumnClause(clause: string): ParsedColumnClause | null {
  const start: number = skipWhitespace(clause, 0);
  const nameToken = readSqlIdentifier(clause, start);
  if (!nameToken) return null;

  const columnName: string = nameToken.value;
  const { type, nextIndex } = parseColumnType(clause, nameToken.nextIndex);
  let i: number = nextIndex;

  let isPrimaryKey: boolean = false;
  let isNotNull: boolean = false;
  let isUnique: boolean = false;
  let isIncrement: boolean = false;
  let defaultValue: string | null = null;
  let note: string | null = null;
  let inlineForeignKey: { targetTable: string; targetColumn: string } | null = null;
  let checkEnumValues: string[] | null = null;

  while (i < clause.length) {
    const j: number = skipWhitespace(clause, i);
    if (j >= clause.length) break;

    let next: number | null;

    if ((next = matchKeyword(clause, j, "PRIMARY KEY")) !== null) {
      isPrimaryKey = true;
      i = next;
      continue;
    }
    if ((next = matchKeyword(clause, j, "NOT NULL")) !== null) {
      isNotNull = true;
      i = next;
      continue;
    }
    if ((next = matchKeyword(clause, j, "NULL")) !== null) {
      i = next;
      continue;
    }
    if ((next = matchKeyword(clause, j, "UNIQUE")) !== null) {
      isUnique = true;
      i = next;
      continue;
    }
    if ((next = matchKeyword(clause, j, "AUTO_INCREMENT")) !== null) {
      isIncrement = true;
      i = next;
      continue;
    }
    if ((next = matchKeyword(clause, j, "AUTOINCREMENT")) !== null) {
      isIncrement = true;
      i = next;
      continue;
    }
    if (
      (next = matchKeyword(clause, j, "GENERATED ALWAYS AS IDENTITY")) !== null ||
      (next = matchKeyword(clause, j, "GENERATED BY DEFAULT AS IDENTITY")) !== null
    ) {
      isIncrement = true;
      const k: number = skipWhitespace(clause, next);
      if (clause[k] === "(") {
        const close: number | null = findMatchingParen(clause, k);
        i = close !== null ? close + 1 : next;
      } else {
        i = next;
      }
      continue;
    }
    if ((next = matchKeyword(clause, j, "IDENTITY")) !== null) {
      isIncrement = true;
      const k: number = skipWhitespace(clause, next);
      if (clause[k] === "(") {
        const close: number | null = findMatchingParen(clause, k);
        i = close !== null ? close + 1 : next;
      } else {
        i = next;
      }
      continue;
    }
    if ((next = matchKeyword(clause, j, "REFERENCES")) !== null) {
      const tableToken = readQualifiedIdentifier(clause, next);
      if (!tableToken) {
        i = next;
        continue;
      }
      const k: number = skipWhitespace(clause, tableToken.nextIndex);
      if (clause[k] === "(") {
        const close: number | null = findMatchingParen(clause, k);
        if (close !== null) {
          const columnToken = readQualifiedIdentifier(clause, k + 1);
          inlineForeignKey = {
            targetTable: tableToken.value,
            targetColumn: columnToken ? columnToken.value : columnName,
          };
          i = close + 1;
          continue;
        }
      }
      inlineForeignKey = { targetTable: tableToken.value, targetColumn: columnName };
      i = tableToken.nextIndex;
      continue;
    }
    if ((next = matchKeyword(clause, j, "DEFAULT")) !== null) {
      const parsed = parseDefaultValue(clause, next);
      defaultValue = parsed.value || null;
      i = parsed.nextIndex;
      continue;
    }
    if ((next = matchKeyword(clause, j, "COMMENT")) !== null) {
      const k: number = skipWhitespace(clause, next);
      const stringToken = readSqlStringLiteral(clause, k);
      if (stringToken) {
        note = stringToken.value;
        i = stringToken.nextIndex;
      } else {
        i = k;
      }
      continue;
    }
    if ((next = matchKeyword(clause, j, "CHECK")) !== null) {
      const k: number = skipWhitespace(clause, next);
      if (clause[k] === "(") {
        const close: number | null = findMatchingParen(clause, k);
        if (close !== null) {
          const values = tryExtractCheckEnumValues(clause.slice(k + 1, close), columnName);
          if (values) checkEnumValues = values;
          i = close + 1;
          continue;
        }
      }
      i = k;
      continue;
    }
    if ((next = matchKeyword(clause, j, "COLLATE")) !== null) {
      const k: number = skipWhitespace(clause, next);
      const identToken = readSqlIdentifier(clause, k);
      i = identToken ? identToken.nextIndex : k;
      continue;
    }

    // Modificador no reconocido (p. ej. "ZEROFILL" suelto, "ON UPDATE ..."): se ignora token a token.
    i = skipUnknownToken(clause, j);
  }

  const enumMatch: RegExpExecArray | null = /^ENUM\s*\(([\s\S]*)\)$/i.exec(type.trim());
  const enumValues: string[] | null = enumMatch
    ? splitTopLevel(enumMatch[1], ",").map(dequoteListItem).filter((v) => v.length > 0)
    : checkEnumValues;

  // Pseudotipos de autoincremento de Postgres: no son un tipo real, hay que
  // traducirlos al tipo entero equivalente + la bandera de incremento.
  const serialMatch: RegExpExecArray | null = /^(SMALL|BIG)?SERIAL$/i.exec(type.trim());
  const SERIAL_PREFIX_TYPE: Record<string, string> = { SMALL: "smallint", BIG: "bigint", "": "integer" };
  const resolvedType: string = serialMatch
    ? (SERIAL_PREFIX_TYPE[(serialMatch[1] ?? "").toUpperCase()] ?? "integer")
    : type;
  if (serialMatch) isIncrement = true;

  const column: DbmlColumn = {
    name: columnName,
    type: resolvedType,
    isPrimaryKey,
    isNotNull: isNotNull || isPrimaryKey,
    isUnique,
    isIncrement,
    isForeignKey: inlineForeignKey !== null,
    defaultValue,
    note,
  };

  return { column, inlineForeignKey, enumValues: enumValues && enumValues.length > 0 ? enumValues : null };
}

type TableLevelConstraint =
  | { kind: "primaryKey"; columns: string[] }
  | { kind: "unique"; columns: string[] }
  | { kind: "foreignKey"; columns: string[]; targetTable: string; targetColumns: string[] }
  | { kind: "ignored"; summary: string };

function readColumnList(clause: string, openParenIndex: number): { columns: string[]; nextIndex: number } | null {
  const close: number | null = findMatchingParen(clause, openParenIndex);
  if (close === null) return null;
  const columns: string[] = splitTopLevel(clause.slice(openParenIndex + 1, close), ",")
    .map(dequoteListItem)
    .filter((c) => c.length > 0);
  return { columns, nextIndex: close + 1 };
}

function summarizeClause(clause: string): string {
  const oneLine: string = clause.replace(/\s+/g, " ").trim();
  return oneLine.length > 50 ? `${oneLine.slice(0, 50)}...` : oneLine;
}

function parseTableLevelClause(clause: string): TableLevelConstraint {
  let i: number = skipWhitespace(clause, 0);

  const constraintKw: number | null = matchKeyword(clause, i, "CONSTRAINT");
  if (constraintKw !== null) {
    const nameToken = readSqlIdentifier(clause, skipWhitespace(clause, constraintKw));
    i = nameToken ? nameToken.nextIndex : constraintKw;
  }

  let next: number | null;

  if ((next = matchKeyword(clause, i, "PRIMARY KEY")) !== null) {
    const k: number = skipWhitespace(clause, next);
    const list = clause[k] === "(" ? readColumnList(clause, k) : null;
    return list ? { kind: "primaryKey", columns: list.columns } : { kind: "ignored", summary: summarizeClause(clause) };
  }

  if ((next = matchKeyword(clause, i, "FOREIGN KEY")) !== null) {
    const k: number = skipWhitespace(clause, next);
    if (clause[k] !== "(") return { kind: "ignored", summary: summarizeClause(clause) };
    const sourceList = readColumnList(clause, k);
    if (!sourceList) return { kind: "ignored", summary: summarizeClause(clause) };

    const refKw: number | null = matchKeyword(clause, sourceList.nextIndex, "REFERENCES");
    if (refKw === null) return { kind: "ignored", summary: summarizeClause(clause) };
    const tableToken = readQualifiedIdentifier(clause, refKw);
    if (!tableToken) return { kind: "ignored", summary: summarizeClause(clause) };

    const afterTable: number = skipWhitespace(clause, tableToken.nextIndex);
    const targetList = clause[afterTable] === "(" ? readColumnList(clause, afterTable) : null;
    return {
      kind: "foreignKey",
      columns: sourceList.columns,
      targetTable: tableToken.value,
      targetColumns: targetList ? targetList.columns : sourceList.columns,
    };
  }

  if ((next = matchKeyword(clause, i, "UNIQUE")) !== null) {
    let k: number = skipWhitespace(clause, next);
    if (clause[k] !== "(") {
      const nameToken = readSqlIdentifier(clause, k);
      k = nameToken ? skipWhitespace(clause, nameToken.nextIndex) : k;
    }
    const list = clause[k] === "(" ? readColumnList(clause, k) : null;
    return list ? { kind: "unique", columns: list.columns } : { kind: "ignored", summary: summarizeClause(clause) };
  }

  return { kind: "ignored", summary: summarizeClause(clause) };
}

interface ParsedCreateTable {
  table: DbmlTable;
  refs: DbmlRef[];
  enums: DbmlEnum[];
  warnings: string[];
}

const TABLE_LEVEL_CLAUSE_PATTERN: RegExp =
  /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|KEY|INDEX|FULLTEXT|SPATIAL)\b/i;

function parseCreateTableStatement(statement: string): ParsedCreateTable | null {
  const afterCreate: number | null = matchKeyword(statement, 0, "CREATE TABLE");
  if (afterCreate === null) return null;

  let i: number = afterCreate;
  const ifNotExists: number | null = matchKeyword(statement, i, "IF NOT EXISTS");
  if (ifNotExists !== null) i = ifNotExists;

  const nameToken = readQualifiedIdentifier(statement, i);
  if (!nameToken) return null;
  const tableName: string = nameToken.value;

  const openParen: number = skipWhitespace(statement, nameToken.nextIndex);
  if (statement[openParen] !== "(") return null;
  const close: number | null = findMatchingParen(statement, openParen);
  if (close === null) return null;

  const clauses: string[] = splitTopLevel(statement.slice(openParen + 1, close), ",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const columns: DbmlColumn[] = [];
  const refs: DbmlRef[] = [];
  const enums: DbmlEnum[] = [];
  const warnings: string[] = [];
  const primaryKeyColumns = new Set<string>();
  const uniqueColumns = new Set<string>();
  const foreignKeyColumns = new Set<string>();

  for (const clause of clauses) {
    if (TABLE_LEVEL_CLAUSE_PATTERN.test(clause)) {
      const constraint = parseTableLevelClause(clause);
      if (constraint.kind === "primaryKey") {
        constraint.columns.forEach((c) => primaryKeyColumns.add(c.toLowerCase()));
      } else if (constraint.kind === "unique") {
        if (constraint.columns.length === 1) {
          uniqueColumns.add(constraint.columns[0].toLowerCase());
        } else {
          warnings.push(
            `Tabla "${tableName}": la restricción UNIQUE compuesta (${constraint.columns.join(", ")}) no se pudo representar y se ignoró.`,
          );
        }
      } else if (constraint.kind === "foreignKey") {
        if (constraint.columns.length === 1 && constraint.targetColumns.length === 1) {
          refs.push({
            left: { table: tableName, column: constraint.columns[0], cardinality: "many" },
            right: { table: constraint.targetTable, column: constraint.targetColumns[0], cardinality: "one" },
          });
          foreignKeyColumns.add(constraint.columns[0].toLowerCase());
        } else {
          warnings.push(`Tabla "${tableName}": la FOREIGN KEY compuesta hacia "${constraint.targetTable}" no se pudo representar y se ignoró.`);
        }
      } else {
        warnings.push(`Tabla "${tableName}": se ignoró "${constraint.summary}".`);
      }
      continue;
    }

    const parsedColumn = parseColumnClause(clause);
    if (!parsedColumn) {
      warnings.push(`Tabla "${tableName}": no se pudo interpretar la columna "${summarizeClause(clause)}".`);
      continue;
    }

    let column: DbmlColumn = parsedColumn.column;

    if (parsedColumn.enumValues) {
      const enumName: string = `${tableName}_${column.name}`.toLowerCase();
      enums.push({ name: enumName, values: parsedColumn.enumValues });
      column = { ...column, type: enumName };
    }

    if (parsedColumn.inlineForeignKey) {
      refs.push({
        left: { table: tableName, column: column.name, cardinality: "many" },
        right: {
          table: parsedColumn.inlineForeignKey.targetTable,
          column: parsedColumn.inlineForeignKey.targetColumn,
          cardinality: "one",
        },
      });
    }

    columns.push(column);
  }

  const finalColumns: DbmlColumn[] = columns.map((column) => {
    const key: string = column.name.toLowerCase();
    const isPrimaryKey: boolean = column.isPrimaryKey || primaryKeyColumns.has(key);
    return {
      ...column,
      isPrimaryKey,
      isNotNull: column.isNotNull || isPrimaryKey,
      isUnique: column.isUnique || uniqueColumns.has(key),
      isForeignKey: column.isForeignKey || foreignKeyColumns.has(key),
    };
  });

  return {
    table: { name: tableName, alias: null, note: null, headerColor: null, columns: finalColumns },
    refs,
    enums,
    warnings,
  };
}

function parseAlterTableForeignKey(statement: string): { ref: DbmlRef | null; warning: string | null } | null {
  const afterAlter: number | null = matchKeyword(statement, 0, "ALTER TABLE");
  if (afterAlter === null) return null;

  const tableToken = readQualifiedIdentifier(statement, afterAlter);
  if (!tableToken) return { ref: null, warning: "Se ignoró una sentencia ALTER TABLE sin nombre de tabla reconocible." };

  const addKw: number | null = matchKeyword(statement, tableToken.nextIndex, "ADD");
  if (addKw === null) {
    return { ref: null, warning: `Se ignoró "ALTER TABLE ${tableToken.value} ..." (no es un ADD CONSTRAINT).` };
  }

  let i: number = addKw;
  const constraintKw: number | null = matchKeyword(statement, i, "CONSTRAINT");
  if (constraintKw !== null) {
    const nameToken = readSqlIdentifier(statement, skipWhitespace(statement, constraintKw));
    i = nameToken ? nameToken.nextIndex : constraintKw;
  }

  const fkKw: number | null = matchKeyword(statement, i, "FOREIGN KEY");
  if (fkKw === null) {
    return { ref: null, warning: `Se ignoró "ALTER TABLE ${tableToken.value} ADD ..." (no es FOREIGN KEY).` };
  }

  const openParen: number = skipWhitespace(statement, fkKw);
  if (statement[openParen] !== "(") {
    return { ref: null, warning: `ALTER TABLE ${tableToken.value}: FOREIGN KEY sin columna, se ignoró.` };
  }
  const sourceList = readColumnList(statement, openParen);
  if (!sourceList) {
    return { ref: null, warning: `ALTER TABLE ${tableToken.value}: FOREIGN KEY mal formada, se ignoró.` };
  }

  const refKw: number | null = matchKeyword(statement, sourceList.nextIndex, "REFERENCES");
  if (refKw === null) {
    return { ref: null, warning: `ALTER TABLE ${tableToken.value}: FOREIGN KEY sin REFERENCES, se ignoró.` };
  }
  const targetTableToken = readQualifiedIdentifier(statement, refKw);
  if (!targetTableToken) {
    return { ref: null, warning: `ALTER TABLE ${tableToken.value}: REFERENCES sin tabla, se ignoró.` };
  }

  const afterTarget: number = skipWhitespace(statement, targetTableToken.nextIndex);
  const targetList = statement[afterTarget] === "(" ? readColumnList(statement, afterTarget) : null;
  const targetColumns: string[] = targetList ? targetList.columns : sourceList.columns;

  if (sourceList.columns.length !== 1 || targetColumns.length !== 1) {
    return {
      ref: null,
      warning: `ALTER TABLE ${tableToken.value}: la FOREIGN KEY compuesta hacia "${targetTableToken.value}" no se pudo representar y se ignoró.`,
    };
  }

  return {
    ref: {
      left: { table: tableToken.value, column: sourceList.columns[0], cardinality: "many" },
      right: { table: targetTableToken.value, column: targetColumns[0], cardinality: "one" },
    },
    warning: null,
  };
}

function parseCreateTypeEnum(statement: string): DbmlEnum | null {
  const afterCreate: number | null = matchKeyword(statement, 0, "CREATE TYPE");
  if (afterCreate === null) return null;

  const nameToken = readQualifiedIdentifier(statement, afterCreate);
  if (!nameToken) return null;

  const asEnum: number | null = matchKeyword(statement, nameToken.nextIndex, "AS ENUM");
  if (asEnum === null) return null;

  const openParen: number = skipWhitespace(statement, asEnum);
  if (statement[openParen] !== "(") return null;
  const close: number | null = findMatchingParen(statement, openParen);
  if (close === null) return null;

  const values: string[] = splitTopLevel(statement.slice(openParen + 1, close), ",")
    .map(dequoteListItem)
    .filter((v) => v.length > 0);

  return { name: nameToken.value, values };
}

/**
 * Importa un subconjunto común de DDL (`CREATE TABLE`, `ALTER TABLE ... ADD
 * FOREIGN KEY`, `CREATE TYPE ... AS ENUM` en Postgres) de los 4 dialectos
 * soportados. No es un parser SQL completo: vistas, triggers, procedimientos
 * y otras sentencias se ignoran silenciosamente; lo que sí se reconoce pero
 * no se puede representar en el modelo (claves compuestas, por ejemplo) se
 * reporta en `schema.warnings`.
 */
export function parseSqlImport(sql: string, dialect: SqlImportDialect): SqlImportResult {
  const cleaned: string = stripSqlComments(sql, dialect === "mariadb" ? "mariadb" : dialect);
  const statements: string[] = splitTopLevel(cleaned, ";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length === 0) {
    return { ok: false, error: "No se encontró ninguna sentencia SQL para importar." };
  }

  const tables: DbmlTable[] = [];
  const refs: DbmlRef[] = [];
  const enums: DbmlEnum[] = [];
  const warnings: string[] = [];
  const seenTableNames = new Set<string>();

  for (const statement of statements) {
    if (matchKeyword(statement, 0, "CREATE TABLE") !== null) {
      const parsed = parseCreateTableStatement(statement);
      if (!parsed) {
        warnings.push("No se pudo interpretar una sentencia CREATE TABLE y se ignoró.");
        continue;
      }
      if (seenTableNames.has(parsed.table.name.toLowerCase())) {
        warnings.push(`La tabla "${parsed.table.name}" aparece repetida; se ignoró la segunda declaración.`);
        continue;
      }
      seenTableNames.add(parsed.table.name.toLowerCase());
      tables.push(parsed.table);
      refs.push(...parsed.refs);
      enums.push(...parsed.enums);
      warnings.push(...parsed.warnings);
      continue;
    }

    if (matchKeyword(statement, 0, "ALTER TABLE") !== null) {
      const result = parseAlterTableForeignKey(statement);
      if (result?.ref) refs.push(result.ref);
      else if (result?.warning) warnings.push(result.warning);
      continue;
    }

    if (dialect === "postgres" && matchKeyword(statement, 0, "CREATE TYPE") !== null) {
      const enumDef = parseCreateTypeEnum(statement);
      if (enumDef) enums.push(enumDef);
      continue;
    }

    // CREATE INDEX, COMMENT ON, GRANT, SET, USE, etc.: ruido habitual en
    // volcados reales, se ignora sin avisar sentencia por sentencia.
  }

  if (tables.length === 0) {
    return { ok: false, error: "No se encontraron tablas (CREATE TABLE) para importar en este SQL." };
  }

  const tableByName = new Map<string, DbmlTable>(tables.map((t) => [t.name.toLowerCase(), t]));
  const validRefs: DbmlRef[] = [];
  let droppedRefCount: number = 0;
  for (const ref of refs) {
    const leftTable = tableByName.get(ref.left.table.toLowerCase());
    const rightTable = tableByName.get(ref.right.table.toLowerCase());
    const leftOk = leftTable?.columns.some((c) => c.name.toLowerCase() === ref.left.column.toLowerCase()) ?? false;
    const rightOk = rightTable?.columns.some((c) => c.name.toLowerCase() === ref.right.column.toLowerCase()) ?? false;
    if (leftTable && rightTable && leftOk && rightOk) {
      validRefs.push(ref);
    } else {
      droppedRefCount += 1;
    }
  }
  if (droppedRefCount > 0) {
    warnings.push(
      `${droppedRefCount} relación(es) apuntaban a una tabla o columna inexistente y no se importaron.`,
    );
  }

  const dedupedEnums: DbmlEnum[] = [];
  const seenEnumNames = new Set<string>();
  for (const enumDef of enums) {
    const key: string = enumDef.name.toLowerCase();
    if (seenEnumNames.has(key)) continue;
    seenEnumNames.add(key);
    dedupedEnums.push(enumDef);
  }

  const schema: DbmlSchema = {
    tables,
    refs: validRefs,
    enums: dedupedEnums,
    tableGroups: [],
    warnings,
  };

  return { ok: true, schema };
}
