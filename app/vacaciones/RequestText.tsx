"use client";

import { useState } from "react";
import { buildRequestSummaryLines } from "./lib/summary";
import type { VacationPlan } from "./lib/planner";

interface RequestTextProps {
  plan: VacationPlan;
}

const COPY_RESET_DELAY_MS = 2200;

export function RequestText({ plan }: RequestTextProps): React.JSX.Element {
  const [copyLabel, setCopyLabel] = useState<string>("Copiar texto");
  const text = buildRequestSummaryLines(plan).join("\n");

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel("Copiado");
    } catch {
      setCopyLabel("No se pudo copiar");
    }
    setTimeout(() => setCopyLabel("Copiar texto"), COPY_RESET_DELAY_MS);
  };

  return (
    <div className="flex flex-col gap-3">
      <pre className="whitespace-pre-wrap rounded-xl border border-black/[.08] p-4 text-sm text-black dark:border-white/[.145] dark:text-zinc-50">
        {text}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        {copyLabel}
      </button>
    </div>
  );
}
