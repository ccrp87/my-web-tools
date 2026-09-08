"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { parseISODate } from "./lib/dates";
import { formatShortDate } from "./lib/format";
import type { VacationPlan } from "./lib/planner";

interface HolidaysEditorProps {
  holidays: ReadonlyMap<string, string>;
  referenceYear: number;
  plan: VacationPlan | null;
  onRemove: (iso: string) => void;
  onAdd: (iso: string, name: string) => void;
}

const DEFAULT_HOLIDAY_NAME = "Día no laboral";

export function HolidaysEditor({
  holidays,
  referenceYear,
  plan,
  onRemove,
  onAdd,
}: HolidaysEditorProps): React.JSX.Element {
  const [newDate, setNewDate] = useState<string>("");
  const [newName, setNewName] = useState<string>("");

  const rows = [...holidays.entries()]
    .filter(([iso]) => {
      const year = Number(iso.slice(0, 4));
      return year === referenceYear || year === referenceYear + 1;
    })
    .sort(([a], [b]) => (a < b ? -1 : 1));

  const handleAdd = (): void => {
    if (!newDate) return;
    onAdd(newDate, newName.trim() || DEFAULT_HOLIDAY_NAME);
    setNewDate("");
    setNewName("");
  };

  return (
    <details className="rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]">
      <summary className="cursor-pointer text-sm font-medium text-black dark:text-zinc-50">
        Revisar y ajustar los festivos
      </summary>

      <p className="mt-3 max-w-[62ch] text-sm text-zinc-600 dark:text-zinc-400">
        Los resaltados caen dentro de tus vacaciones. Quita los que no
        apliquen en tu empresa o agrega días de cierre colectivo.
      </p>

      <div className="my-4 flex flex-wrap gap-2">
        {rows.map(([iso, name]) => {
          const date = parseISODate(iso);
          const isUsed =
            plan !== null && date >= plan.restStart && date <= plan.restEnd;
          return (
            <span
              key={iso}
              className={`inline-flex items-center gap-1.5 rounded-lg border py-1 pr-1 pl-2.5 text-xs ${
                isUsed
                  ? "border-amber-500 bg-amber-50 dark:bg-amber-950"
                  : "border-black/[.15] dark:border-white/[.2]"
              }`}
            >
              <b className="font-semibold">{formatShortDate(date)}</b> {name}
              <button
                type="button"
                onClick={() => onRemove(iso)}
                aria-label={`Quitar ${name}`}
                title={`Quitar ${name}`}
                className="px-1 text-sm leading-none text-zinc-500 hover:text-amber-700 dark:text-zinc-400 dark:hover:text-amber-400"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 min-w-[8rem] flex-col gap-1.5">
          <label
            htmlFor="vacaciones-new-holiday-date"
            className="text-xs font-medium text-black dark:text-zinc-50"
          >
            Fecha
          </label>
          <input
            id="vacaciones-new-holiday-date"
            type="date"
            value={newDate}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setNewDate(event.target.value)
            }
            className="rounded-lg border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus-visible:border-black dark:border-white/[.2] dark:text-zinc-50 dark:focus-visible:border-white"
          />
        </div>
        <div className="flex flex-1 min-w-[8rem] flex-col gap-1.5">
          <label
            htmlFor="vacaciones-new-holiday-name"
            className="text-xs font-medium text-black dark:text-zinc-50"
          >
            Nombre
          </label>
          <input
            id="vacaciones-new-holiday-name"
            type="text"
            placeholder="Cierre de fin de año"
            value={newName}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setNewName(event.target.value)
            }
            className="rounded-lg border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus-visible:border-black dark:border-white/[.2] dark:text-zinc-50 dark:focus-visible:border-white"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Agregar día
        </button>
      </div>
    </details>
  );
}
