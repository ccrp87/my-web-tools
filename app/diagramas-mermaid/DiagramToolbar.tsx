"use client";

import type { DiagramExample } from "./lib/examples";

export type CopyState = "idle" | "copied" | "error";

interface DiagramToolbarProps {
  examples: readonly DiagramExample[];
  activeExampleKey: string;
  onSelectExample: (key: string) => void;
  onCopyCode: () => void;
  copyState: CopyState;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  canExport: boolean;
  exportError: string | null;
}

const BUTTON_CLASSES: string =
  "rounded-lg border border-black/[.08] px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.08]";

const COPY_LABEL: Record<CopyState, string> = {
  idle: "Copiar código",
  copied: "¡Copiado!",
  error: "No se pudo copiar",
};

export function DiagramToolbar({
  examples,
  activeExampleKey,
  onSelectExample,
  onCopyCode,
  copyState,
  onDownloadSvg,
  onDownloadPng,
  canExport,
  exportError,
}: DiagramToolbarProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          Ejemplo:
          <select
            value={activeExampleKey}
            onChange={(event) => onSelectExample(event.target.value)}
            className="rounded-lg border border-black/[.08] bg-transparent px-2 py-1.5 text-sm text-zinc-800 dark:border-white/[.145] dark:text-zinc-200"
          >
            {activeExampleKey === "" && (
              <option value="" disabled hidden>
                Personalizado
              </option>
            )}
            {examples.map((example) => (
              <option key={example.key} value={example.key}>
                {example.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={onCopyCode} className={BUTTON_CLASSES}>
          {COPY_LABEL[copyState]}
        </button>

        <button
          type="button"
          onClick={onDownloadSvg}
          disabled={!canExport}
          className={BUTTON_CLASSES}
        >
          Descargar SVG
        </button>

        <button
          type="button"
          onClick={onDownloadPng}
          disabled={!canExport}
          className={BUTTON_CLASSES}
        >
          Descargar PNG
        </button>
      </div>

      {exportError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {exportError}
        </p>
      )}
    </div>
  );
}
