"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import { DiagramToolbar } from "./DiagramToolbar";
import type { CopyState } from "./DiagramToolbar";
import { downloadPngFromSvg, downloadSvgMarkup, copyTextToClipboard } from "./exportDiagram";
import { buildDiagramFileName } from "./lib/download";
import { DEFAULT_DIAGRAM_EXAMPLE, DIAGRAM_EXAMPLES } from "./lib/examples";
import { replaceFlowchartNodeLabel, upsertFlowchartNodeStyle } from "./lib/flowchartNodes";
import { MermaidPreview } from "./MermaidPreview";
import type { MermaidRenderOutcome } from "./MermaidPreview";
import type { NodeEditValues } from "./NodeEditPopover";

const STORAGE_KEY: string = "diagramas-mermaid:code";
const CODE_CHANGE_EVENT: string = "diagramas-mermaid-code-change";
const RENDER_DEBOUNCE_MS: number = 350;
const COPY_FEEDBACK_MS: number = 1600;

function readStoredCode(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Escribe el código y avisa a este mismo hook (vía evento) de que el valor cambió. */
function writeStoredCode(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Almacenamiento no disponible (p. ej. modo privado): se pierde la
    // persistencia entre recargas, pero la herramienta sigue funcionando.
  }
  window.dispatchEvent(new Event(CODE_CHANGE_EVENT));
}

/** Reacciona a cambios propios (evento local) y a cambios desde otras pestañas (storage). */
function subscribeToStoredCode(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CODE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CODE_CHANGE_EVENT, onStoreChange);
  };
}

function getStoredCodeSnapshot(): string {
  const stored: string | null = readStoredCode();
  return stored && stored.trim() !== "" ? stored : DEFAULT_DIAGRAM_EXAMPLE.code;
}

function getServerCodeSnapshot(): string {
  return DEFAULT_DIAGRAM_EXAMPLE.code;
}

export function MermaidEditor(): React.JSX.Element {
  const code = useSyncExternalStore(
    subscribeToStoredCode,
    getStoredCodeSnapshot,
    getServerCodeSnapshot,
  );
  const [debouncedCode, setDebouncedCode] = useState<string>(code);
  const [lastLoadedExampleCode, setLastLoadedExampleCode] = useState<string>(
    DEFAULT_DIAGRAM_EXAMPLE.code,
  );
  const [renderOutcome, setRenderOutcome] = useState<MermaidRenderOutcome>({
    status: "empty",
  });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [nodeEditWarning, setNodeEditWarning] = useState<string | null>(null);

  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      setDebouncedCode(code);
    }, RENDER_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [code]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleCodeChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): void => {
      writeStoredCode(event.target.value);
    },
    [],
  );

  const handleSelectExample = useCallback(
    (key: string): void => {
      const example = DIAGRAM_EXAMPLES.find((candidate) => candidate.key === key);
      if (!example) return;

      const isDirty: boolean = code !== lastLoadedExampleCode;
      if (isDirty) {
        const confirmed: boolean = window.confirm(
          "Esto reemplazará el código actual por el ejemplo elegido. ¿Continuar?",
        );
        if (!confirmed) return;
      }

      writeStoredCode(example.code);
      setLastLoadedExampleCode(example.code);
    },
    [code, lastLoadedExampleCode],
  );

  const handleCopyCode = useCallback((): void => {
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
    }

    void copyTextToClipboard(code).then((didCopy) => {
      setCopyState(didCopy ? "copied" : "error");
      copyFeedbackTimeoutRef.current = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
    });
  }, [code]);

  const handleDownloadSvg = useCallback((): void => {
    if (renderOutcome.status !== "ok") return;

    try {
      downloadSvgMarkup(renderOutcome.svg, buildDiagramFileName("svg"));
      setExportError(null);
    } catch {
      setExportError("No se pudo descargar el SVG.");
    }
  }, [renderOutcome]);

  const handleDownloadPng = useCallback((): void => {
    if (renderOutcome.status !== "ok") return;

    const isDarkTheme: boolean = document.documentElement.classList.contains("dark");
    const backgroundColor: string = isDarkTheme ? "#09090b" : "#ffffff";

    downloadPngFromSvg(renderOutcome.svg, buildDiagramFileName("png"), backgroundColor)
      .then(() => setExportError(null))
      .catch(() => setExportError("No se pudo generar el PNG."));
  }, [renderOutcome]);

  const handleApplyNodeEdit = useCallback(
    (edit: NodeEditValues): void => {
      const codeWithLabel: string | null = replaceFlowchartNodeLabel(
        code,
        edit.nodeId,
        edit.label,
      );
      const nextCode: string = upsertFlowchartNodeStyle(
        codeWithLabel ?? code,
        edit.nodeId,
        edit.colorHex,
      );
      writeStoredCode(nextCode);
      setNodeEditWarning(
        codeWithLabel === null
          ? "El color se aplicó, pero no se pudo actualizar el texto de este nodo automáticamente; edítalo en el código."
          : null,
      );
    },
    [code],
  );

  const canExport: boolean = renderOutcome.status === "ok";
  const activeExampleKey: string =
    DIAGRAM_EXAMPLES.find((example) => example.code === code)?.key ?? "";

  return (
    <div className="flex w-full flex-col gap-4">
      <DiagramToolbar
        examples={DIAGRAM_EXAMPLES}
        activeExampleKey={activeExampleKey}
        onSelectExample={handleSelectExample}
        onCopyCode={handleCopyCode}
        copyState={copyState}
        onDownloadSvg={handleDownloadSvg}
        onDownloadPng={handleDownloadPng}
        canExport={canExport}
        exportError={exportError}
      />

      {nodeEditWarning && (
        <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
          {nodeEditWarning}
        </p>
      )}

      <div className="grid w-full flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <textarea
          value={code}
          onChange={handleCodeChange}
          spellCheck={false}
          aria-label="Código Mermaid"
          className="min-h-80 w-full resize-y rounded-xl border border-black/[.08] bg-white p-4 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-white/[.145] dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600"
        />

        <MermaidPreview
          code={debouncedCode}
          onRenderChange={setRenderOutcome}
          onApplyNodeEdit={handleApplyNodeEdit}
        />
      </div>
    </div>
  );
}
