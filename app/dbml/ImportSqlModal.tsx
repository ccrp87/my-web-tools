"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { CloseIcon, UploadIcon } from "./Icons";
import { SQL_IMPORT_DIALECT_LABELS } from "./lib/sqlImport/types";
import type { SqlImportDialect } from "./lib/sqlImport/types";

interface ImportSqlModalProps {
  onClose: () => void;
  onImport: (sql: string, dialect: SqlImportDialect) => void;
  error: string | null;
}

const DIALECT_OPTIONS: readonly SqlImportDialect[] = ["postgres", "mysql", "mariadb", "sqlserver"];

export function ImportSqlModal({ onClose, onImport, error }: ImportSqlModalProps): React.JSX.Element {
  const [dialect, setDialect] = useState<SqlImportDialect>("postgres");
  const [sql, setSql] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRequestFileUpload = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (): void => {
      setSql(typeof reader.result === "string" ? reader.result : "");
      setFileError(null);
    };
    reader.onerror = (): void => setFileError("No se pudo leer el archivo.");
    reader.readAsText(file);
  };

  const canImport: boolean = sql.trim() !== "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar SQL"
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-6 shadow-xl dark:border-white/[.145] dark:bg-zinc-950"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Importar SQL</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-black/[.05] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          >
            <CloseIcon />
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pega sentencias <code>CREATE TABLE</code> (y opcionalmente{" "}
          <code>ALTER TABLE ... FOREIGN KEY</code>) o sube un archivo <code>.sql</code>. Se admite el
          subconjunto común de los 4 dialectos: vistas, triggers y procedimientos se ignoran.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Dialecto de origen</span>
          <div className="flex flex-wrap gap-1.5">
            {DIALECT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={dialect === option}
                onClick={() => setDialect(option)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  dialect === option
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-black/[.04] text-zinc-700 hover:bg-black/[.08] dark:bg-white/[.08] dark:text-zinc-300 dark:hover:bg-white/[.12]"
                }`}
              >
                {SQL_IMPORT_DIALECT_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={sql}
          onChange={(event) => setSql(event.target.value)}
          placeholder={"CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) NOT NULL UNIQUE\n);"}
          spellCheck={false}
          className="h-56 w-full resize-none rounded-lg border border-black/[.08] bg-white p-3 font-mono text-sm text-zinc-900 outline-none focus:border-black/30 dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30"
        />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleRequestFileUpload}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.05] dark:text-zinc-300 dark:hover:bg-white/[.08]"
          >
            <UploadIcon />
            <span>Subir archivo .sql</span>
          </button>
          {fileError && <span className="text-sm text-red-600 dark:text-red-400">{fileError}</span>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".sql,text/plain"
          onChange={handleFileSelected}
          className="hidden"
        />

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.05] dark:text-zinc-300 dark:hover:bg-white/[.08]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canImport}
            onClick={() => onImport(sql, dialect)}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Importar
          </button>
        </div>
      </div>
    </div>
  );
}
