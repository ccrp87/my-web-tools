"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { getRegionalFairsForYear } from "./lib/ferias";
import { formatShortDate } from "./lib/format";
import type { SeasonWindow, SeasonWindowKind } from "./lib/temporadas";

interface SeasonEditorProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  windows: readonly SeasonWindow[];
  referenceYear: number;
  onRemoveKind: (kind: SeasonWindowKind) => void;
  onAddCustom: (start: string, end: string, label: string) => void;
  onRemoveCustom: (id: string) => void;
}

const DEFAULT_LABEL = "Periodo personalizado";

export function SeasonEditor({
  enabled,
  onToggleEnabled,
  windows,
  referenceYear,
  onRemoveKind,
  onAddCustom,
  onRemoveCustom,
}: SeasonEditorProps): React.JSX.Element {
  const [newStart, setNewStart] = useState<string>("");
  const [newEnd, setNewEnd] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");

  const fairs = getRegionalFairsForYear(referenceYear);

  const handleAdd = (): void => {
    if (!newStart || !newEnd) return;
    onAddCustom(newStart, newEnd, newLabel.trim() || DEFAULT_LABEL);
    setNewStart("");
    setNewEnd("");
    setNewLabel("");
  };

  return (
    <details className="rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]">
      <summary className="cursor-pointer text-sm font-medium text-black dark:text-zinc-50">
        Revisar temporada alta y ferias regionales
      </summary>

      <label className="mt-3 flex items-center gap-2 text-sm text-black dark:text-zinc-50">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggleEnabled(event.target.checked)}
          className="h-4 w-4 accent-black dark:accent-white"
        />
        Mostrar clasificación por temporada alta/baja
      </label>

      {enabled && (
        <>
          <p className="mt-3 max-w-[62ch] text-sm text-zinc-600 dark:text-zinc-400">
            Valores por defecto según el uso del sector turístico y el
            calendario escolar oficial; no tienen respaldo normativo. Quita
            los que no apliquen o agrega periodos propios.
          </p>

          <div className="my-4 flex flex-wrap gap-2">
            {windows
              .filter(
                (window) =>
                  window.kind === "personalizada" ||
                  window.id === `${window.kind}-${referenceYear}`,
              )
              .map((window) => (
              <span
                key={window.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[.15] bg-white py-1 pr-1 pl-2.5 text-xs dark:border-white/[.2] dark:bg-transparent"
              >
                <b className="font-semibold">{window.label}</b>{" "}
                {formatShortDate(window.start)}–{formatShortDate(window.end)}
                <button
                  type="button"
                  onClick={() =>
                    window.kind === "personalizada"
                      ? onRemoveCustom(window.id)
                      : onRemoveKind(window.kind)
                  }
                  aria-label={`Quitar ${window.label}`}
                  title={`Quitar ${window.label}`}
                  className="px-1 text-sm leading-none text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 min-w-[8rem] flex-col gap-1.5">
              <label
                htmlFor="vacaciones-new-season-start"
                className="text-xs font-medium text-black dark:text-zinc-50"
              >
                Desde
              </label>
              <input
                id="vacaciones-new-season-start"
                type="date"
                value={newStart}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setNewStart(event.target.value)
                }
                className="rounded-lg border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus-visible:border-black dark:border-white/[.2] dark:text-zinc-50 dark:focus-visible:border-white"
              />
            </div>
            <div className="flex flex-1 min-w-[8rem] flex-col gap-1.5">
              <label
                htmlFor="vacaciones-new-season-end"
                className="text-xs font-medium text-black dark:text-zinc-50"
              >
                Hasta
              </label>
              <input
                id="vacaciones-new-season-end"
                type="date"
                value={newEnd}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setNewEnd(event.target.value)
                }
                className="rounded-lg border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus-visible:border-black dark:border-white/[.2] dark:text-zinc-50 dark:focus-visible:border-white"
              />
            </div>
            <div className="flex flex-1 min-w-[8rem] flex-col gap-1.5">
              <label
                htmlFor="vacaciones-new-season-label"
                className="text-xs font-medium text-black dark:text-zinc-50"
              >
                Nombre
              </label>
              <input
                id="vacaciones-new-season-label"
                type="text"
                placeholder="Cierre de inventario"
                value={newLabel}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setNewLabel(event.target.value)
                }
                className="rounded-lg border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus-visible:border-black dark:border-white/[.2] dark:text-zinc-50 dark:focus-visible:border-white"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Agregar periodo
            </button>
          </div>

          <div className="mt-5 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
            <p className="text-sm font-medium text-black dark:text-zinc-50">
              Ferias regionales (referencia)
            </p>
            <p className="mt-1 max-w-[62ch] text-xs text-zinc-500 dark:text-zinc-400">
              Solo afectan precios y ocupación en su ciudad; no son temporada
              alta ni cambian el orden de las sugerencias. Solo el Carnaval de
              Barranquilla y las de fecha fija son exactas: las demás las
              fijan sus organizadores cada año y aquí van aproximadas.
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              {fairs.map((fair) => (
                <li key={fair.name}>
                  <b className="font-semibold text-black dark:text-zinc-50">
                    {fair.name}
                  </b>{" "}
                  — {fair.city}, {formatShortDate(fair.start)}–
                  {formatShortDate(fair.end)}
                  {fair.approximate ? " (aprox.)" : ""}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </details>
  );
}
