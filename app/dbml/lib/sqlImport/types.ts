import type { DbmlSchema } from "../parser/types";

export type SqlImportDialect = "postgres" | "mysql" | "mariadb" | "sqlserver";

export const SQL_IMPORT_DIALECT_LABELS: Record<SqlImportDialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mariadb: "MariaDB",
  sqlserver: "SQL Server",
};

export type SqlImportResult =
  | { ok: true; schema: DbmlSchema }
  | { ok: false; error: string };
