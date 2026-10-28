"use client";

import { TrashIcon } from "./Icons";
import { sortByUpdatedAtDesc } from "./lib/library";
import type { SavedDiagram } from "./lib/library";

interface DiagramLibraryPanelProps {
  diagrams: readonly SavedDiagram[];
  onSaveCurrentAsNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatUpdatedAt(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DiagramLibraryPanel({
  diagrams,
  onSaveCurrentAsNew,
  onOpen,
  onDelete,
  onClose,
}: DiagramLibraryPanelProps): React.JSX.Element {
  const sorted = sortByUpdatedAtDesc(diagrams);

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="absolute left-0 top-full z-30 mt-1 flex w-80 flex-col gap-2 rounded-lg border border-black/[.08] bg-white p-3 text-sm shadow-lg dark:border-white/[.145] dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Mis diagramas</span>
        <button
          type="button"
          onClick={onSaveCurrentAsNew}
          className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Guardar actual como...
        </button>
      </div>

      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Todavía no has guardado ningún diagrama.
          </p>
        )}
        {sorted.map((diagram) => (
          <div
            key={diagram.id}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            <button
              type="button"
              onClick={() => onOpen(diagram.id)}
              className="flex min-w-0 flex-1 flex-col items-start text-left"
            >
              <span className="w-full truncate text-sm text-zinc-900 dark:text-zinc-100">{diagram.name}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatUpdatedAt(diagram.updatedAt)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(diagram.id)}
              aria-label={`Eliminar ${diagram.name}`}
              className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="self-end rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
      >
        Cerrar
      </button>
    </div>
  );
}
