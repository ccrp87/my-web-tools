/**
 * Compara tipos de columna "a ojo" para decidir si tiene sentido crear una
 * relación entre ellas al arrastrar en el visualizador. No es una validación
 * estricta de tipos SQL: agrupa variantes equivalentes entre dialectos
 * (`INT`, `INTEGER`, `SERIAL`...) en categorías amplias; cualquier tipo que
 * no encaje en una categoría conocida (incluidos los enums, cuyo "tipo" es
 * el nombre del enum) se compara por igualdad exacta de texto.
 */

const CATEGORY_PATTERNS: readonly [RegExp, string][] = [
  [/^(tinyint|smallint|mediumint|int\d*|integer|bigint|serial|bigserial|smallserial)\b/, "integer"],
  [/^(decimal|numeric|float|double|real|money)\b/, "decimal"],
  [/^(varchar|nvarchar|char|nchar|text|ntext|character|clob|string)\b/, "text"],
  [/^(bool|boolean|bit)\b/, "boolean"],
  [/^(timestamp|datetime\d*|date|time|year)\b/, "datetime"],
  [/^(uuid|uniqueidentifier|guid)\b/, "uuid"],
  [/^(json|jsonb)\b/, "json"],
  [/^(blob|bytea|binary|varbinary|longblob|image)\b/, "binary"],
];

function normalizeType(rawType: string): string {
  return rawType
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\bunsigned\b|\bzerofill\b/g, "")
    .trim();
}

/** Categoría amplia de un tipo de columna; los tipos no reconocidos (incl. enums) usan su propio nombre normalizado. */
export function getColumnTypeCategory(rawType: string): string {
  const normalized: string = normalizeType(rawType);
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(normalized)) return category;
  }
  return normalized;
}

export function areColumnTypesCompatible(typeA: string, typeB: string): boolean {
  return getColumnTypeCategory(typeA) === getColumnTypeCategory(typeB);
}
