"use client";

import type { SeasonFilterMode } from "./lib/seasonSuggestions";

interface SeasonModeControlProps {
  mode: SeasonFilterMode;
  onChange: (mode: SeasonFilterMode) => void;
}

interface ModeOption {
  value: SeasonFilterMode;
  label: string;
}

const OPTIONS: readonly ModeOption[] = [
  { value: "indiferente", label: "Indiferente" },
  { value: "excluir_alta", label: "Excluir temporada alta" },
  { value: "preferir_alta", label: "Preferir temporada alta" },
];

export function SeasonModeControl({
  mode,
  onChange,
}: SeasonModeControlProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        id="vacaciones-season-mode-label"
        className="text-sm font-medium text-black dark:text-zinc-50"
      >
        Sugerencias frente a la temporada
      </span>
      <div
        role="group"
        aria-labelledby="vacaciones-season-mode-label"
        className="flex flex-wrap overflow-hidden rounded-lg border border-black/[.15] dark:border-white/[.2]"
      >
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 whitespace-nowrap border-r border-black/[.15] px-3 py-2 text-xs font-medium transition-colors last:border-r-0 dark:border-white/[.2] ${
              mode === option.value
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-zinc-600 hover:bg-black/[.02] dark:text-zinc-400 dark:hover:bg-white/[.04]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
