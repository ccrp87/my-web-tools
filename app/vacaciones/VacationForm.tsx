"use client";

import type { ChangeEvent } from "react";
import { DatePicker } from "./DatePicker";
import type { VacationCountMode } from "./lib/planner";

interface VacationFormProps {
  startISO: string;
  days: number | null;
  mode: VacationCountMode;
  holidays: ReadonlyMap<string, string>;
  onStartChange: (iso: string) => void;
  onDaysChange: (days: number | null) => void;
  onModeChange: (mode: VacationCountMode) => void;
}

const MODE_HINTS: Record<VacationCountMode, string> = {
  habiles:
    "Solo cuentan lunes a viernes no festivos, como en las vacaciones legales.",
  calendario: "Cuenta todos los días corridos, incluidos fines de semana y festivos.",
};

export function VacationForm({
  startISO,
  days,
  mode,
  holidays,
  onStartChange,
  onDaysChange,
  onModeChange,
}: VacationFormProps): React.JSX.Element {
  const handleDaysChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = parseInt(event.target.value, 10);
    onDaysChange(Number.isFinite(value) ? Math.min(Math.max(value, 1), 365) : null);
  };

  return (
    <form
      autoComplete="off"
      className="flex w-full flex-col gap-4 rounded-2xl border border-black/[.08] p-5 dark:border-white/[.145]"
    >
      <DatePicker
        id="vacaciones-start"
        label="Primer día de vacaciones"
        value={startISO}
        holidays={holidays}
        onChange={onStartChange}
      />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="vacaciones-days"
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Días que quieres tomar
        </label>
        <input
          id="vacaciones-days"
          type="number"
          min={1}
          max={365}
          step={1}
          value={days ?? ""}
          onChange={handleDaysChange}
          className="rounded-lg border border-black/[.15] bg-transparent px-3 py-2 text-sm text-black outline-none focus-visible:border-black dark:border-white/[.2] dark:text-zinc-50 dark:focus-visible:border-white"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span
          id="vacaciones-mode-label"
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Contar esos días como
        </span>
        <div
          role="group"
          aria-labelledby="vacaciones-mode-label"
          className="flex overflow-hidden rounded-lg border border-black/[.15] dark:border-white/[.2]"
        >
          <button
            type="button"
            aria-pressed={mode === "habiles"}
            onClick={() => onModeChange("habiles")}
            className={`flex-1 border-r border-black/[.15] px-3 py-2 text-xs font-medium transition-colors dark:border-white/[.2] ${
              mode === "habiles"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-zinc-600 hover:bg-black/[.02] dark:text-zinc-400 dark:hover:bg-white/[.04]"
            }`}
          >
            Días hábiles
          </button>
          <button
            type="button"
            aria-pressed={mode === "calendario"}
            onClick={() => onModeChange("calendario")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              mode === "calendario"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-zinc-600 hover:bg-black/[.02] dark:text-zinc-400 dark:hover:bg-white/[.04]"
            }`}
          >
            Días calendario
          </button>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {MODE_HINTS[mode]}
        </p>
      </div>
    </form>
  );
}
