import type { SqlDialect } from "./sql/generateSql";

export type DiagramFileExtension = "svg" | "png" | "dbml";

/** Nombre de archivo estable para el diagrama exportado. */
export function buildDiagramFileName(extension: DiagramFileExtension): string {
  return `diagrama-dbml.${extension}`;
}

const SQL_DIALECT_FILE_SUFFIX: Record<SqlDialect, string> = {
  postgres: "postgres",
  mysql: "mysql",
  sqlserver: "sqlserver",
};

/** Nombre de archivo para el SQL exportado, distinguiendo el dialecto. */
export function buildSqlFileName(dialect: SqlDialect): string {
  return `diagrama-dbml-${SQL_DIALECT_FILE_SUFFIX[dialect]}.sql`;
}
