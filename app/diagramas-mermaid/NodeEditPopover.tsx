"use client";

import { useRef } from "react";
import type { FormEvent, MouseEvent } from "react";

export interface SelectedFlowchartNode {
  nodeId: string;
  label: string;
  colorHex: string;
  x: number;
  y: number;
}

export interface NodeEditValues {
  nodeId: string;
  label: string;
  colorHex: string;
}

interface NodeEditPopoverProps {
  node: SelectedFlowchartNode;
  onApply: (edit: NodeEditValues) => void;
  onClose: () => void;
}

export function NodeEditPopover({
  node,
  onApply,
  onClose,
}: NodeEditPopoverProps): React.JSX.Element {
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onApply({
      nodeId: node.nodeId,
      label: labelInputRef.current?.value ?? node.label,
      colorHex: colorInputRef.current?.value ?? node.colorHex,
    });
  }

  function stopClickPropagation(event: MouseEvent<HTMLFormElement>): void {
    event.stopPropagation();
  }

  return (
    <form
      onClick={stopClickPropagation}
      onSubmit={handleSubmit}
      style={{ left: node.x, top: node.y }}
      className="absolute z-10 flex w-56 flex-col gap-2 rounded-lg border border-black/[.08] bg-white p-3 text-sm shadow-lg dark:border-white/[.145] dark:bg-zinc-900"
    >
      <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
        Texto del nodo
        <input
          ref={labelInputRef}
          type="text"
          defaultValue={node.label}
          className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.145] dark:text-zinc-100"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        Color
        <input
          ref={colorInputRef}
          type="color"
          defaultValue={node.colorHex}
          className="h-7 w-10 cursor-pointer rounded border border-black/[.08] bg-transparent dark:border-white/[.145]"
        />
      </label>

      <div className="flex justify-end gap-2 pt-1">
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
    </form>
  );
}
