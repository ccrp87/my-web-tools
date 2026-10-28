import {
  findMatchingBrace,
  lineNumberAt,
  readLogicalLine,
  readNameToken,
  readQualifiedName,
  skipWhitespace,
} from "./cursor";
import { parseColumnSettings, parseTableGroupSettings, parseTableSettings } from "./columnSettings";
import type { InlineRef } from "./columnSettings";
import { splitSettingsList, unquote } from "./settings";
import { stripComments } from "./stripComments";
import { cardinalitiesForSymbol } from "./types";
import type {
  DbmlColumn,
  DbmlEnum,
  DbmlParseResult,
  DbmlRef,
  DbmlTable,
  DbmlTableGroup,
  RefSymbol,
} from "./types";

interface ParseFailure {
  ok: false;
  message: string;
  atIndex: number;
}

interface InternalColumn extends DbmlColumn {
  inlineRef: InlineRef | null;
}

interface TableBodyResult {
  ok: true;
  columns: InternalColumn[];
  note: string | null;
}

interface TableDeclarationResult {
  ok: true;
  table: DbmlTable;
  inlineRefs: Array<{ fromColumn: string; symbol: RefSymbol; toTable: string; toColumn: string }>;
  nextIndex: number;
}

interface RefDeclarationResult {
  ok: true;
  refs: DbmlRef[];
  skippedComposite: boolean;
  nextIndex: number;
}

interface EnumDeclarationResult {
  ok: true;
  enumDef: DbmlEnum;
  nextIndex: number;
}

interface TableGroupDeclarationResult {
  ok: true;
  tableGroup: DbmlTableGroup;
  nextIndex: number;
}

const REF_SYMBOL_PATTERN = /^(<>|<|>|-)/;

function parseColumnLine(lineText: string): InternalColumn | null {
  const nameResult = readNameToken(lineText, 0);
  if (!nameResult) return null;
  let i: number = skipWhitespace(lineText, nameResult.nextIndex);

  const typeStart: number = i;
  const typeNameResult = readQualifiedName(lineText, i);
  if (!typeNameResult) return null;
  i = typeNameResult.nextIndex;
  let typeText: string = lineText.slice(typeStart, i);

  if (lineText[i] === "(") {
    const close: number = lineText.indexOf(")", i);
    if (close !== -1) {
      typeText += lineText.slice(i, close + 1);
      i = close + 1;
    }
  }
  i = skipWhitespace(lineText, i);

  let settingsList: string[] = [];
  if (lineText[i] === "[") {
    const close = findMatchingBrace(lineText, i, "[", "]");
    if (close !== null) {
      settingsList = splitSettingsList(lineText.slice(i + 1, close));
    }
  }

  const settings = parseColumnSettings(settingsList);

  return {
    name: nameResult.value,
    type: typeText,
    isPrimaryKey: settings.isPrimaryKey,
    isNotNull: settings.isNotNull,
    isUnique: settings.isUnique,
    isIncrement: settings.isIncrement,
    isForeignKey: false,
    defaultValue: settings.defaultValue,
    note: settings.note,
    inlineRef: settings.inlineRef,
  };
}

function parseTableBody(body: string): TableBodyResult | ParseFailure {
  const columns: InternalColumn[] = [];
  let note: string | null = null;
  let i: number = 0;
  const length: number = body.length;

  while (true) {
    i = skipWhitespace(body, i);
    if (i >= length) break;

    const peekKeyword = readNameToken(body, i);
    const lowerKeyword: string | undefined = peekKeyword?.value.toLowerCase();

    if (lowerKeyword === "note" && peekKeyword) {
      const afterKeyword: number = skipWhitespace(body, peekKeyword.nextIndex);
      if (body[afterKeyword] === ":") {
        const line = readLogicalLine(body, afterKeyword + 1);
        note = unquote(line.value.trim());
        i = line.nextIndex + 1;
      } else if (body[afterKeyword] === "{") {
        const close = findMatchingBrace(body, afterKeyword);
        if (close === null) {
          return { ok: false, message: 'Falta cerrar "}" en Note.', atIndex: afterKeyword };
        }
        note = unquote(body.slice(afterKeyword + 1, close).trim());
        i = close + 1;
      } else {
        i = peekKeyword.nextIndex;
      }
      continue;
    }

    if (lowerKeyword === "indexes" && peekKeyword) {
      const afterKeyword: number = skipWhitespace(body, peekKeyword.nextIndex);
      if (body[afterKeyword] === "{") {
        const close = findMatchingBrace(body, afterKeyword);
        if (close === null) {
          return { ok: false, message: 'Falta cerrar "}" en Indexes.', atIndex: afterKeyword };
        }
        i = close + 1;
      } else {
        i = peekKeyword.nextIndex;
      }
      continue;
    }

    const lineResult = readLogicalLine(body, i);
    const lineText: string = lineResult.value.trim();
    i = lineResult.nextIndex + 1;
    if (lineText === "") continue;

    const columnResult = parseColumnLine(lineText);
    if (!columnResult) {
      return {
        ok: false,
        message: `No se pudo interpretar la columna: "${lineText}".`,
        atIndex: Math.max(0, i - lineText.length - 1),
      };
    }
    columns.push(columnResult);
  }

  return { ok: true, columns, note };
}

function parseTableDeclaration(
  text: string,
  index: number,
): TableDeclarationResult | ParseFailure {
  let i: number = skipWhitespace(text, index);
  const nameResult = readQualifiedName(text, i);
  if (!nameResult) {
    return { ok: false, message: 'Se esperaba un nombre de tabla después de "Table".', atIndex: i };
  }
  const name: string = nameResult.value;
  i = skipWhitespace(text, nameResult.nextIndex);

  let alias: string | null = null;
  if (text.slice(i, i + 2) === "as" && /[\s{[]/.test(text[i + 2] ?? "")) {
    const afterAs: number = skipWhitespace(text, i + 2);
    const aliasResult = readNameToken(text, afterAs);
    if (aliasResult) {
      alias = aliasResult.value;
      i = skipWhitespace(text, aliasResult.nextIndex);
    }
  }

  let headerColor: string | null = null;
  let tableSettingsNote: string | null = null;
  if (text[i] === "[") {
    const close = findMatchingBrace(text, i, "[", "]");
    if (close === null) {
      return { ok: false, message: 'Falta cerrar "]" en los ajustes de la tabla.', atIndex: i };
    }
    const settings = parseTableSettings(splitSettingsList(text.slice(i + 1, close)));
    headerColor = settings.headerColor;
    tableSettingsNote = settings.note;
    i = skipWhitespace(text, close + 1);
  }

  if (text[i] !== "{") {
    return {
      ok: false,
      message: `Se esperaba "{" después del nombre de la tabla "${name}".`,
      atIndex: i,
    };
  }
  const closeBrace = findMatchingBrace(text, i);
  if (closeBrace === null) {
    return { ok: false, message: `Falta cerrar "}" de la tabla "${name}".`, atIndex: i };
  }
  const body: string = text.slice(i + 1, closeBrace);

  const bodyResult = parseTableBody(body);
  if (!bodyResult.ok) {
    return { ok: false, message: bodyResult.message, atIndex: i + 1 + bodyResult.atIndex };
  }

  const inlineRefs = bodyResult.columns
    .filter((column) => column.inlineRef !== null)
    .map((column) => ({
      fromColumn: column.name,
      symbol: column.inlineRef!.symbol,
      toTable: column.inlineRef!.table,
      toColumn: column.inlineRef!.column,
    }));

  const publicColumns: DbmlColumn[] = bodyResult.columns.map(
    (column): DbmlColumn => ({
      name: column.name,
      type: column.type,
      isPrimaryKey: column.isPrimaryKey,
      isNotNull: column.isNotNull,
      isUnique: column.isUnique,
      isIncrement: column.isIncrement,
      isForeignKey: column.isForeignKey,
      defaultValue: column.defaultValue,
      note: column.note,
    }),
  );

  return {
    ok: true,
    table: {
      name,
      alias,
      note: bodyResult.note ?? tableSettingsNote,
      headerColor,
      columns: publicColumns,
    },
    inlineRefs,
    nextIndex: closeBrace + 1,
  };
}

interface RefEndpointParse {
  table: string;
  column: string | null;
  composite: boolean;
  nextIndex: number;
}

/**
 * Lee un extremo de relación: `tabla.columna`, `esquema.tabla.columna`
 * (se usa el penúltimo segmento como tabla, descartando el esquema) o
 * `tabla.(col1, col2)` (columna compuesta, no soportada más allá de
 * detectarla). No se puede usar `readQualifiedName` aquí porque esa
 * función colapsa todo a su último segmento, perdiendo la separación
 * entre tabla y columna que necesitamos distinguir.
 */
function tryParseRefEndpoint(text: string, index: number): RefEndpointParse | null {
  const first = readNameToken(text, index);
  if (!first) return null;

  const segments: string[] = [first.value];
  let i: number = first.nextIndex;

  while (text[i] === ".") {
    const next = readNameToken(text, i + 1);
    if (!next) break;
    segments.push(next.value);
    i = next.nextIndex;
  }

  if (text[i] === "." && text[i + 1] === "(") {
    const close: number = text.indexOf(")", i + 2);
    if (close === -1) return null;
    const table: string = segments[segments.length - 1];
    return { table, column: null, composite: true, nextIndex: close + 1 };
  }

  if (segments.length < 2) return null;

  const column: string = segments[segments.length - 1];
  const table: string = segments[segments.length - 2];
  return { table, column, composite: false, nextIndex: i };
}

interface RefStatementParse {
  ref: DbmlRef | null;
  skippedComposite: boolean;
}

function parseRefStatement(line: string): RefStatementParse | null {
  let i: number = skipWhitespace(line, 0);
  const left = tryParseRefEndpoint(line, i);
  if (!left) return null;

  i = skipWhitespace(line, left.nextIndex);
  const symbolMatch = line.slice(i).match(REF_SYMBOL_PATTERN);
  if (!symbolMatch) return null;
  const symbol = symbolMatch[0] as RefSymbol;
  i = skipWhitespace(line, i + symbol.length);

  const right = tryParseRefEndpoint(line, i);
  if (!right) return null;

  if (left.composite || right.composite) {
    return { ref: null, skippedComposite: true };
  }

  const [leftCardinality, rightCardinality] = cardinalitiesForSymbol(symbol);
  return {
    ref: {
      left: { table: left.table, column: left.column as string, cardinality: leftCardinality },
      right: { table: right.table, column: right.column as string, cardinality: rightCardinality },
    },
    skippedComposite: false,
  };
}

function parseRefDeclaration(text: string, index: number): RefDeclarationResult | ParseFailure {
  let i: number = skipWhitespace(text, index);

  if (text[i] !== ":" && text[i] !== "{") {
    const nameResult = readNameToken(text, i);
    if (nameResult) i = skipWhitespace(text, nameResult.nextIndex);
  }

  if (text[i] === ":") {
    const line = readLogicalLine(text, i + 1);
    const trimmed: string = line.value.trim();
    const parsed = parseRefStatement(trimmed);
    if (!parsed) {
      return { ok: false, message: `No se pudo interpretar la relación: "${trimmed}".`, atIndex: i };
    }
    return {
      ok: true,
      refs: parsed.ref ? [parsed.ref] : [],
      skippedComposite: parsed.skippedComposite,
      nextIndex: line.nextIndex,
    };
  }

  if (text[i] === "{") {
    const close = findMatchingBrace(text, i);
    if (close === null) {
      return { ok: false, message: 'Falta cerrar "}" en Ref.', atIndex: i };
    }
    const body: string = text.slice(i + 1, close);
    const refs: DbmlRef[] = [];
    let skippedComposite: boolean = false;

    for (const rawLine of body.split("\n")) {
      const line: string = rawLine.trim();
      if (line === "") continue;
      const parsed = parseRefStatement(line);
      if (!parsed) {
        return { ok: false, message: `No se pudo interpretar la relación: "${line}".`, atIndex: i };
      }
      if (parsed.ref) refs.push(parsed.ref);
      if (parsed.skippedComposite) skippedComposite = true;
    }

    return { ok: true, refs, skippedComposite, nextIndex: close + 1 };
  }

  return { ok: false, message: 'Se esperaba ":" o "{" después de "Ref".', atIndex: i };
}

function parseEnumDeclaration(text: string, index: number): EnumDeclarationResult | ParseFailure {
  let i: number = skipWhitespace(text, index);
  const nameResult = readQualifiedName(text, i);
  if (!nameResult) {
    return { ok: false, message: 'Se esperaba un nombre después de "Enum".', atIndex: i };
  }
  i = skipWhitespace(text, nameResult.nextIndex);

  if (text[i] !== "{") {
    return {
      ok: false,
      message: `Se esperaba "{" después del nombre del enum "${nameResult.value}".`,
      atIndex: i,
    };
  }
  const close = findMatchingBrace(text, i);
  if (close === null) {
    return { ok: false, message: `Falta cerrar "}" del enum "${nameResult.value}".`, atIndex: i };
  }

  const body: string = text.slice(i + 1, close);
  const values: string[] = [];
  for (const rawLine of body.split("\n")) {
    const line: string = rawLine.trim();
    if (line === "") continue;
    const valueResult = readNameToken(line, 0);
    if (valueResult) values.push(valueResult.value);
  }

  return { ok: true, enumDef: { name: nameResult.value, values }, nextIndex: close + 1 };
}

function parseTableGroupDeclaration(
  text: string,
  index: number,
): TableGroupDeclarationResult | ParseFailure {
  let i: number = skipWhitespace(text, index);
  const nameResult = readQualifiedName(text, i);
  if (!nameResult) {
    return { ok: false, message: 'Se esperaba un nombre después de "TableGroup".', atIndex: i };
  }
  i = skipWhitespace(text, nameResult.nextIndex);

  let color: string | null = null;
  if (text[i] === "[") {
    const closeSettings = findMatchingBrace(text, i, "[", "]");
    if (closeSettings === null) {
      return { ok: false, message: 'Falta cerrar "]" en los ajustes del área.', atIndex: i };
    }
    const settings = parseTableGroupSettings(splitSettingsList(text.slice(i + 1, closeSettings)));
    color = settings.color;
    i = skipWhitespace(text, closeSettings + 1);
  }

  if (text[i] !== "{") {
    return {
      ok: false,
      message: `Se esperaba "{" después del nombre del área "${nameResult.value}".`,
      atIndex: i,
    };
  }
  const close = findMatchingBrace(text, i);
  if (close === null) {
    return { ok: false, message: `Falta cerrar "}" del área "${nameResult.value}".`, atIndex: i };
  }

  const body: string = text.slice(i + 1, close);
  const memberTables: string[] = [];
  for (const rawLine of body.split("\n")) {
    const line: string = rawLine.trim();
    if (line === "") continue;
    const tableNameResult = readNameToken(line, 0);
    if (tableNameResult) memberTables.push(tableNameResult.value);
  }

  return {
    ok: true,
    tableGroup: { name: nameResult.value, color, tables: memberTables },
    nextIndex: close + 1,
  };
}

function skipUnsupportedDeclaration(
  text: string,
  index: number,
): { ok: true; nextIndex: number } | ParseFailure {
  let i: number = skipWhitespace(text, index);

  const nameResult = readQualifiedName(text, i);
  if (nameResult) i = skipWhitespace(text, nameResult.nextIndex);

  if (text[i] === "{") {
    const close = findMatchingBrace(text, i);
    if (close === null) return { ok: false, message: 'Falta cerrar "}".', atIndex: i };
    return { ok: true, nextIndex: close + 1 };
  }

  if (text[i] === ":") {
    const line = readLogicalLine(text, i + 1);
    return { ok: true, nextIndex: line.nextIndex };
  }

  return { ok: false, message: 'Se esperaba "{" o ":" para esta declaración.', atIndex: i };
}

/** Parsea un documento DBML completo en un modelo de datos estructurado. */
export function parseDbml(source: string): DbmlParseResult {
  // stripComments conserva el largo/saltos de línea del original, así que
  // los números de línea calculados sobre el texto limpio siguen siendo
  // válidos para reportar errores.
  const cleaned: string = stripComments(source);
  const tables: DbmlTable[] = [];
  const refs: DbmlRef[] = [];
  const enums: DbmlEnum[] = [];
  const tableGroups: DbmlTableGroup[] = [];
  const warnings: string[] = [];
  const tableNames = new Set<string>();
  const tableGroupNames = new Set<string>();
  const pendingInlineRefs: Array<{
    fromTable: string;
    fromColumn: string;
    symbol: RefSymbol;
    toTable: string;
    toColumn: string;
  }> = [];

  let i: number = 0;
  const length: number = cleaned.length;

  function fail(message: string, atIndex: number): DbmlParseResult {
    return { ok: false, error: { message, line: lineNumberAt(cleaned, atIndex) } };
  }

  while (true) {
    i = skipWhitespace(cleaned, i);
    if (i >= length) break;

    const keywordMatch = readNameToken(cleaned, i);
    if (!keywordMatch) {
      return fail(`Carácter inesperado: "${cleaned[i]}".`, i);
    }

    const keyword: string = keywordMatch.value;
    i = keywordMatch.nextIndex;

    if (keyword === "Table") {
      const result = parseTableDeclaration(cleaned, i);
      if (!result.ok) return fail(result.message, result.atIndex);

      if (tableNames.has(result.table.name)) {
        warnings.push(`Se ignoró una tabla duplicada: "${result.table.name}".`);
      } else {
        tableNames.add(result.table.name);
        tables.push(result.table);
        for (const inline of result.inlineRefs) {
          pendingInlineRefs.push({
            fromTable: result.table.name,
            fromColumn: inline.fromColumn,
            symbol: inline.symbol,
            toTable: inline.toTable,
            toColumn: inline.toColumn,
          });
        }
      }
      i = result.nextIndex;
    } else if (keyword === "Ref") {
      const result = parseRefDeclaration(cleaned, i);
      if (!result.ok) return fail(result.message, result.atIndex);

      refs.push(...result.refs);
      if (result.skippedComposite) {
        warnings.push("Se ignoró una relación con columnas compuestas (no soportado).");
      }
      i = result.nextIndex;
    } else if (keyword === "Enum") {
      const result = parseEnumDeclaration(cleaned, i);
      if (!result.ok) return fail(result.message, result.atIndex);

      enums.push(result.enumDef);
      i = result.nextIndex;
    } else if (keyword === "TableGroup") {
      const result = parseTableGroupDeclaration(cleaned, i);
      if (!result.ok) return fail(result.message, result.atIndex);

      if (tableGroupNames.has(result.tableGroup.name)) {
        warnings.push(`Se ignoró un área duplicada: "${result.tableGroup.name}".`);
      } else {
        tableGroupNames.add(result.tableGroup.name);
        tableGroups.push(result.tableGroup);
      }
      i = result.nextIndex;
    } else {
      const skip = skipUnsupportedDeclaration(cleaned, i);
      if (!skip.ok) return fail(skip.message, skip.atIndex);

      warnings.push(`Se ignoró un bloque "${keyword}" (no soportado).`);
      i = skip.nextIndex;
    }
  }

  for (const inline of pendingInlineRefs) {
    const [fromCardinality, toCardinality] = cardinalitiesForSymbol(inline.symbol);
    refs.push({
      left: { table: inline.fromTable, column: inline.fromColumn, cardinality: fromCardinality },
      right: { table: inline.toTable, column: inline.toColumn, cardinality: toCardinality },
    });
  }

  const columnExists = (table: string, column: string): boolean => {
    const found = tables.find((candidate) => candidate.name === table);
    return !!found && found.columns.some((candidateColumn) => candidateColumn.name === column);
  };

  let droppedRefCount: number = 0;
  const validRefs: DbmlRef[] = refs.filter((ref) => {
    const isValid: boolean =
      columnExists(ref.left.table, ref.left.column) && columnExists(ref.right.table, ref.right.column);
    if (!isValid) droppedRefCount += 1;
    return isValid;
  });
  if (droppedRefCount > 0) {
    warnings.push(
      `Se ignoraron ${droppedRefCount} relación(es) que apuntan a una tabla o columna inexistente.`,
    );
  }

  const foreignKeyPairs = new Set<string>();
  for (const ref of validRefs) {
    foreignKeyPairs.add(`${ref.left.table}.${ref.left.column}`);
    foreignKeyPairs.add(`${ref.right.table}.${ref.right.column}`);
  }
  for (const table of tables) {
    for (const column of table.columns) {
      column.isForeignKey = foreignKeyPairs.has(`${table.name}.${column.name}`);
    }
  }

  return { ok: true, schema: { tables, refs: validRefs, enums, tableGroups, warnings } };
}
