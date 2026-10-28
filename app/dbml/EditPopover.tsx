"use client";

import { useEffect, useRef } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { DbmlColumn, DbmlTable, DbmlTableGroup } from "./lib/parser/types";

export type EditTarget =
  | {
      kind: "table";
      table: DbmlTable;
      allAreas: DbmlTableGroup[];
      currentAreaName: string | null;
    }
  | { kind: "column"; table: DbmlTable; column: DbmlColumn }
  | { kind: "area"; group: DbmlTableGroup; allTableNames: string[] };

/**
 * Identifica de forma estable a qué entidad apunta el popover. Se usa como
 * `key` de React al montarlo: como sus campos son no controlados
 * (`defaultValue`), si el usuario hace clic en una columna distinta sin que
 * el componente se desmonte, los inputs se quedarían mostrando los valores
 * de la primera columna en vez de actualizarse a la nueva.
 */
export function buildEditTargetKey(target: EditTarget): string {
  if (target.kind === "table") return `table:${target.table.name}`;
  if (target.kind === "column") return `column:${target.table.name}.${target.column.name}`;
  return `area:${target.group.name}`;
}

export interface TableEditPatch {
  name: string;
  note: string | null;
  headerColor: string | null;
  areaName: string | null;
}

const NO_AREA_VALUE: string = "";

export interface ColumnEditPatch {
  name: string;
  type: string;
  note: string | null;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isUnique: boolean;
}

export interface AreaEditPatch {
  name: string;
  color: string | null;
  tables: string[];
}

const DEFAULT_TABLE_COLOR: string = "#4f46e5";
const DEFAULT_AREA_COLOR: string = "#0ea5e9";

interface EditPopoverProps {
  target: EditTarget;
  x: number;
  y: number;
  onApplyTable: (originalTableName: string, patch: TableEditPatch) => void;
  onApplyColumn: (
    tableName: string,
    originalColumnName: string,
    patch: ColumnEditPatch,
  ) => void;
  onApplyArea: (originalAreaName: string, patch: AreaEditPatch) => void;
  onDeleteArea: (areaName: string) => void;
  onClose: () => void;
}

const INPUT_CLASSES: string =
  "rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-100";

export function EditPopover({
  target,
  x,
  y,
  onApplyTable,
  onApplyColumn,
  onApplyArea,
  onDeleteArea,
  onClose,
}: EditPopoverProps): React.JSX.Element {
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const noteInputRef = useRef<HTMLInputElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const primaryKeyRef = useRef<HTMLInputElement | null>(null);
  const notNullRef = useRef<HTMLInputElement | null>(null);
  const uniqueRef = useRef<HTMLInputElement | null>(null);
  const tableCheckboxesRef = useRef<Map<string, HTMLInputElement>>(new Map());
  const areaSelectRef = useRef<HTMLSelectElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    function handleOutsidePointerDown(event: globalThis.MouseEvent): void {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutsidePointerDown);
    return () => document.removeEventListener("mousedown", handleOutsidePointerDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (target.kind === "table") {
      onApplyTable(target.table.name, {
        name: nameInputRef.current?.value.trim() || target.table.name,
        note: noteInputRef.current?.value.trim() || null,
        headerColor: colorInputRef.current?.value || null,
        areaName: areaSelectRef.current?.value || null,
      });
      return;
    }

    if (target.kind === "area") {
      const selectedTables: string[] = target.allTableNames.filter(
        (tableName) => tableCheckboxesRef.current.get(tableName)?.checked,
      );
      onApplyArea(target.group.name, {
        name: nameInputRef.current?.value.trim() || target.group.name,
        color: colorInputRef.current?.value || null,
        tables: selectedTables,
      });
      return;
    }

    onApplyColumn(target.table.name, target.column.name, {
      name: nameInputRef.current?.value.trim() || target.column.name,
      type: typeInputRef.current?.value.trim() || target.column.type,
      note: noteInputRef.current?.value.trim() || null,
      isPrimaryKey: primaryKeyRef.current?.checked ?? false,
      isNotNull: notNullRef.current?.checked ?? false,
      isUnique: uniqueRef.current?.checked ?? false,
    });
  }

  function stopClickPropagation(event: MouseEvent<HTMLFormElement>): void {
    event.stopPropagation();
  }

  const nameLabel: string =
    target.kind === "table" ? "Nombre de la tabla" : target.kind === "area" ? "Nombre del área" : "Nombre de la columna";
  const nameValue: string =
    target.kind === "table" ? target.table.name : target.kind === "area" ? target.group.name : target.column.name;
  const currentNote: string | null = target.kind === "table" ? target.table.note : target.kind === "column" ? target.column.note : null;
  const colorValue: string =
    target.kind === "table"
      ? target.table.headerColor ?? DEFAULT_TABLE_COLOR
      : target.kind === "area"
        ? target.group.color ?? DEFAULT_AREA_COLOR
        : DEFAULT_TABLE_COLOR;

  return (
    <form
      ref={formRef}
      onClick={stopClickPropagation}
      onSubmit={handleSubmit}
      style={{ left: x, top: y }}
      className="absolute z-20 flex w-64 flex-col gap-2 rounded-lg border border-black/[.08] bg-white p-3 text-sm shadow-lg dark:border-white/[.145] dark:bg-zinc-900"
    >
      <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
        {nameLabel}
        <input ref={nameInputRef} type="text" defaultValue={nameValue} className={INPUT_CLASSES} />
      </label>

      {target.kind === "column" && (
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Tipo de dato
          <input ref={typeInputRef} type="text" defaultValue={target.column.type} className={INPUT_CLASSES} />
        </label>
      )}

      {(target.kind === "table" || target.kind === "area") && (
        <label className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          Color
          <input
            ref={colorInputRef}
            type="color"
            defaultValue={colorValue}
            className="h-7 w-10 cursor-pointer rounded border border-black/[.08] bg-transparent dark:border-white/[.145]"
          />
        </label>
      )}

      {target.kind === "table" && (
        <label className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          Área
          <select
            ref={areaSelectRef}
            defaultValue={target.currentAreaName ?? NO_AREA_VALUE}
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-100"
          >
            <option value={NO_AREA_VALUE}>Ninguna</option>
            {target.allAreas.map((area) => (
              <option key={area.name} value={area.name}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {target.kind !== "area" && (
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Comentario
          <input
            ref={noteInputRef}
            type="text"
            defaultValue={currentNote ?? ""}
            placeholder="Sin comentario"
            className={INPUT_CLASSES}
          />
        </label>
      )}

      {target.kind === "column" && (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <label className="flex items-center gap-1">
            <input ref={primaryKeyRef} type="checkbox" defaultChecked={target.column.isPrimaryKey} />
            Llave primaria
          </label>
          <label className="flex items-center gap-1">
            <input ref={notNullRef} type="checkbox" defaultChecked={target.column.isNotNull} />
            Obligatoria
          </label>
          <label className="flex items-center gap-1">
            <input ref={uniqueRef} type="checkbox" defaultChecked={target.column.isUnique} />
            Única
          </label>
        </div>
      )}

      {target.kind === "area" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Tablas en el área</span>
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md border border-black/[.08] p-1.5 dark:border-white/[.145]">
            {target.allTableNames.length === 0 && (
              <span className="text-xs text-zinc-400">No hay tablas todavía.</span>
            )}
            {target.allTableNames.map((tableName) => (
              <label key={tableName} className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  defaultChecked={target.group.tables.includes(tableName)}
                  ref={(element) => {
                    if (element) tableCheckboxesRef.current.set(tableName, element);
                    else tableCheckboxesRef.current.delete(tableName);
                  }}
                />
                {tableName}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {target.kind === "area" ? (
          <button
            type="button"
            onClick={() => onDeleteArea(target.group.name)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Eliminar área
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Aplicar
          </button>
        </div>
      </div>
    </form>
  );
}
