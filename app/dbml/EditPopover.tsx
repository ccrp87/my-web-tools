"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { ChevronDownIcon } from "./Icons";
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

const PRESET_COLORS: readonly string[] = [
  "#4f46e5",
  "#0ea5e9",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#475569",
  "#18181b",
];

const HEX_COLOR_PATTERN: RegExp = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Selector de color propio (no `<input type="color">`): ese control delega
 * en el picker nativo del sistema operativo, cuyo cierre no se puede
 * controlar de forma confiable entre navegadores. Aquí el popover es
 * nuestro, así que elegir un preset cierra al instante y el campo hex
 * cierra con Enter o al perder foco.
 */
function ColorPickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hexDraft, setHexDraft] = useState<string>(value);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setHexDraft(value);

    function handlePointerDown(event: globalThis.MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, value]);

  function commitHexDraft(): void {
    if (HEX_COLOR_PATTERN.test(hexDraft)) onChange(hexDraft);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Elegir color"
        style={{ backgroundColor: value }}
        className="h-7 w-10 cursor-pointer rounded border border-black/[.08] dark:border-white/[.145]"
      />

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 flex w-44 flex-col gap-2 rounded-lg border border-black/[.08] bg-white p-2.5 shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
                style={{ backgroundColor: color }}
                className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                  color.toLowerCase() === value.toLowerCase()
                    ? "border-2 border-zinc-900 dark:border-white"
                    : "border-black/[.08] dark:border-white/[.145]"
                }`}
              />
            ))}
          </div>
          <input
            type="text"
            value={hexDraft}
            onChange={(event) => {
              const next = event.target.value;
              setHexDraft(next);
              if (HEX_COLOR_PATTERN.test(next)) onChange(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitHexDraft();
              }
            }}
            onBlur={commitHexDraft}
            placeholder="#4f46e5"
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-100"
          />
        </div>
      )}
    </div>
  );
}

/** Desplegable propio: la lista de `<option>` de un `<select>` nativo no se puede re-estilar entre navegadores. */
function AreaPickerField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: globalThis.MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const label: string = value === NO_AREA_VALUE ? "Ninguna" : value;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none transition-colors hover:bg-black/[.03] focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-100 dark:hover:bg-white/[.05]"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-md border border-black/[.08] bg-white py-1 shadow-lg dark:border-white/[.145] dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              onChange(NO_AREA_VALUE);
              setIsOpen(false);
            }}
            className={`block w-full px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-black/[.05] dark:hover:bg-white/[.08] ${
              value === NO_AREA_VALUE ? "font-medium text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Ninguna
          </button>
          {options.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onChange(name);
                setIsOpen(false);
              }}
              className={`block w-full truncate px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-black/[.05] dark:hover:bg-white/[.08] ${
                value === name ? "font-medium text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  onPreviewColor: (color: string | null) => void;
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
  onPreviewColor,
}: EditPopoverProps): React.JSX.Element {
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const noteInputRef = useRef<HTMLInputElement | null>(null);
  const primaryKeyRef = useRef<HTMLInputElement | null>(null);
  const notNullRef = useRef<HTMLInputElement | null>(null);
  const uniqueRef = useRef<HTMLInputElement | null>(null);
  const tableCheckboxesRef = useRef<Map<string, HTMLInputElement>>(new Map());
  const formRef = useRef<HTMLFormElement | null>(null);

  const initialColor: string =
    target.kind === "table"
      ? target.table.headerColor ?? DEFAULT_TABLE_COLOR
      : target.kind === "area"
        ? target.group.color ?? DEFAULT_AREA_COLOR
        : DEFAULT_TABLE_COLOR;
  const [currentColor, setCurrentColor] = useState<string>(initialColor);
  const [currentArea, setCurrentArea] = useState<string>(
    target.kind === "table" ? target.currentAreaName ?? NO_AREA_VALUE : NO_AREA_VALUE,
  );

  function handleColorChange(color: string): void {
    setCurrentColor(color);
    onPreviewColor(color);
  }

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
        headerColor: currentColor || null,
        areaName: currentArea || null,
      });
      return;
    }

    if (target.kind === "area") {
      const selectedTables: string[] = target.allTableNames.filter(
        (tableName) => tableCheckboxesRef.current.get(tableName)?.checked,
      );
      onApplyArea(target.group.name, {
        name: nameInputRef.current?.value.trim() || target.group.name,
        color: currentColor || null,
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
          <ColorPickerField value={currentColor} onChange={handleColorChange} />
        </label>
      )}

      {target.kind === "table" && (
        <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          Área
          <AreaPickerField
            value={currentArea}
            options={target.allAreas.map((area) => area.name)}
            onChange={setCurrentArea}
          />
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
