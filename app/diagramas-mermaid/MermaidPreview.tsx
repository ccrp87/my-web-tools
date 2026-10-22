"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { rgbStringToHex } from "./lib/color";
import { extractFlowchartNodeId } from "./lib/flowchartNodes";
import { NodeEditPopover } from "./NodeEditPopover";
import type { NodeEditValues, SelectedFlowchartNode } from "./NodeEditPopover";

export type MermaidRenderOutcome =
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ok"; svg: string };

interface MermaidPreviewProps {
  code: string;
  onRenderChange: (outcome: MermaidRenderOutcome) => void;
  onApplyNodeEdit: (edit: NodeEditValues) => void;
}

const ZOOM_STEP: number = 0.2;
const MIN_ZOOM: number = 0.4;
const MAX_ZOOM: number = 3;
const FALLBACK_NODE_COLOR: string = "#ffffff";
const NODE_SHAPE_SELECTOR: string = "rect, polygon, path, circle, ellipse";

function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const root: HTMLElement = document.documentElement;
    const updateFromDom = (): void => setIsDark(root.classList.contains("dark"));
    updateFromDom();

    const observer: MutationObserver = new MutationObserver(updateFromDom);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function MermaidPreview({
  code,
  onRenderChange,
  onApplyNodeEdit,
}: MermaidPreviewProps): React.JSX.Element {
  const isDarkTheme: boolean = useIsDarkTheme();
  const renderIdPrefix: string = useId().replace(/[^a-zA-Z0-9]/g, "");
  const renderCounterRef = useRef<number>(0);
  const currentRenderIdRef = useRef<string>("");
  const onRenderChangeRef = useRef(onRenderChange);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [selectedNode, setSelectedNode] = useState<SelectedFlowchartNode | null>(null);

  useEffect(() => {
    onRenderChangeRef.current = onRenderChange;
  }, [onRenderChange]);

  useEffect(() => {
    let isCancelled: boolean = false;

    async function renderDiagram(): Promise<void> {
      setSelectedNode(null);

      const trimmedCode: string = code.trim();
      if (!trimmedCode) {
        setSvg(null);
        setDiagramType(null);
        setErrorMessage(null);
        onRenderChangeRef.current({ status: "empty" });
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDarkTheme ? "dark" : "default",
          // Sin esto, Mermaid inserta su propio diagrama de "Syntax error"
          // visible al final del <body> en vez de solo lanzar el error.
          suppressErrorRendering: true,
        });

        renderCounterRef.current += 1;
        const renderId: string = `${renderIdPrefix}-${renderCounterRef.current}`;
        const result = await mermaid.render(renderId, trimmedCode);
        if (isCancelled) return;

        currentRenderIdRef.current = renderId;
        setSvg(result.svg);
        setDiagramType(result.diagramType);
        setErrorMessage(null);
        onRenderChangeRef.current({ status: "ok", svg: result.svg });
      } catch (error) {
        if (isCancelled) return;

        const message: string =
          error instanceof Error
            ? error.message
            : "El diagrama tiene un error de sintaxis.";
        setSvg(null);
        setDiagramType(null);
        setErrorMessage(message);
        onRenderChangeRef.current({ status: "error", message });
      }
    }

    void renderDiagram();

    return () => {
      isCancelled = true;
    };
  }, [code, isDarkTheme, renderIdPrefix]);

  const canZoomOut: boolean = zoom > MIN_ZOOM;
  const canZoomIn: boolean = zoom < MAX_ZOOM;
  // Mermaid registra los flowcharts estándar bajo la clave "flowchart-v2"
  // (no "flowchart"), tanto para la sintaxis `flowchart` como `graph`.
  const isEditableDiagram: boolean = diagramType === "flowchart-v2";

  function handleContainerClick(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!isEditableDiagram) return;

    const nodeGroup = (event.target as Element).closest("g.node");
    const container = containerRef.current;
    if (!nodeGroup || !container) {
      setSelectedNode(null);
      return;
    }

    const nodeId = extractFlowchartNodeId(nodeGroup.id, currentRenderIdRef.current);
    if (!nodeId) {
      setSelectedNode(null);
      return;
    }

    const labelElement = nodeGroup.querySelector(".nodeLabel") ?? nodeGroup;
    const label: string = (labelElement.textContent ?? "").trim();

    const shapeElement = nodeGroup.querySelector(NODE_SHAPE_SELECTOR);
    const computedFill: string | null = shapeElement
      ? getComputedStyle(shapeElement).fill
      : null;
    const colorHex: string =
      (computedFill && rgbStringToHex(computedFill)) || FALLBACK_NODE_COLOR;

    const containerRect: DOMRect = container.getBoundingClientRect();
    setSelectedNode({
      nodeId,
      label,
      colorHex,
      x: event.clientX - containerRect.left + container.scrollLeft,
      y: event.clientY - containerRect.top + container.scrollTop,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
          disabled={!canZoomOut}
          aria-label="Alejar"
          className="h-7 w-7 rounded-md border border-black/[.08] text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.08]"
        >
          −
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
          disabled={!canZoomIn}
          aria-label="Acercar"
          className="h-7 w-7 rounded-md border border-black/[.08] text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.08]"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="rounded-md border border-black/[.08] px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.08]"
        >
          Restablecer
        </button>
      </div>

      {isEditableDiagram && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Consejo: haz clic en un nodo para editar su texto o color.
        </p>
      )}

      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="relative min-h-80 flex-1 overflow-auto rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
      >
        {errorMessage && (
          <div
            role="alert"
            className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {!errorMessage && !svg && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Escribe código Mermaid para ver aquí el diagrama.
          </p>
        )}

        {!errorMessage && svg && (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
            className={isEditableDiagram ? "[&_.node]:cursor-pointer" : undefined}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}

        {selectedNode && (
          <NodeEditPopover
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onApply={(edit) => {
              onApplyNodeEdit(edit);
              setSelectedNode(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
