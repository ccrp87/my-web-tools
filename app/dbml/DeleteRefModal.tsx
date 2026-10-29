"use client";

interface DeleteRefModalProps {
  sourceLabel: string;
  targetLabel: string;
  fkTableName: string;
  fkColumnName: string;
  onCancel: () => void;
  onDeleteRefOnly: () => void;
  onDeleteRefAndColumn: () => void;
}

export function DeleteRefModal({
  sourceLabel,
  targetLabel,
  fkTableName,
  fkColumnName,
  onCancel,
  onDeleteRefOnly,
  onDeleteRefAndColumn,
}: DeleteRefModalProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Eliminar relación"
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] bg-white p-6 shadow-xl dark:border-white/[.145] dark:bg-zinc-950"
      >
        <h2 className="text-base font-semibold text-black dark:text-zinc-50">Eliminar relación</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Relación entre <strong className="text-zinc-900 dark:text-zinc-100">{sourceLabel}</strong> y{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">{targetLabel}</strong>. La columna FK es{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">
            {fkTableName}.{fkColumnName}
          </strong>
          .
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onDeleteRefAndColumn}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Eliminar relación y columna
          </button>
          <button
            type="button"
            onClick={onDeleteRefOnly}
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.05] dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.08]"
          >
            Eliminar solo la relación
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-black/[.05] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
