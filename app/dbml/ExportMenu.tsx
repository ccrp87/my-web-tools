"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CopyIcon, FileDownloadIcon } from "./Icons";
import type { SqlDialect } from "./lib/sql/generateSql";
import type { CopyState } from "./DiagramToolbar";

const SQL_DIALECT_LABELS: Record<SqlDialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlserver: "SQL Server",
};

const COPY_ITEM_LABEL: Record<CopyState, string> = {
  idle: "Copiar código",
  copied: "¡Copiado!",
  error: "No se pudo copiar",
};

interface ExportMenuProps {
  onCopyCode: () => void;
  copyState: CopyState;
  onDownloadDbml: () => void;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onDownloadSql: (dialect: SqlDialect) => void;
  canExport: boolean;
}

const MENU_ITEM_CLASSES: string =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-white/[.08]";

function MenuDivider(): React.JSX.Element {
  return <div className="my-1 h-px bg-black/[.08] dark:bg-white/[.145]" />;
}

export function ExportMenu({
  onCopyCode,
  copyState,
  onDownloadDbml,
  onDownloadSvg,
  onDownloadPng,
  onDownloadSql,
  canExport,
}: ExportMenuProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Exportar el diagrama"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.05] active:scale-95 dark:text-zinc-300 dark:hover:bg-white/[.1]"
      >
        <FileDownloadIcon />
        <span>Exportar</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 flex w-52 flex-col gap-0.5 rounded-lg border border-black/[.08] bg-white p-1.5 text-sm shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
          <button type="button" onClick={onCopyCode} className={MENU_ITEM_CLASSES}>
            <CopyIcon />
            <span>{COPY_ITEM_LABEL[copyState]}</span>
          </button>

          <MenuDivider />

          <button
            type="button"
            onClick={() => {
              onDownloadDbml();
              setIsOpen(false);
            }}
            disabled={!canExport}
            className={MENU_ITEM_CLASSES}
          >
            <FileDownloadIcon />
            <span>Descargar .dbml</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDownloadSvg();
              setIsOpen(false);
            }}
            disabled={!canExport}
            className={MENU_ITEM_CLASSES}
          >
            <FileDownloadIcon />
            <span>Descargar SVG</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDownloadPng();
              setIsOpen(false);
            }}
            disabled={!canExport}
            className={MENU_ITEM_CLASSES}
          >
            <FileDownloadIcon />
            <span>Descargar PNG</span>
          </button>

          <MenuDivider />

          {(Object.entries(SQL_DIALECT_LABELS) as [SqlDialect, string][]).map(([dialect, label]) => (
            <button
              key={dialect}
              type="button"
              onClick={() => {
                onDownloadSql(dialect);
                setIsOpen(false);
              }}
              disabled={!canExport}
              className={MENU_ITEM_CLASSES}
            >
              <FileDownloadIcon />
              <span>SQL · {label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
