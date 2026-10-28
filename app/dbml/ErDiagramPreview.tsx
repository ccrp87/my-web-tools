"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { buildEditTargetKey, EditPopover } from "./EditPopover";
import type { AreaEditPatch, ColumnEditPatch, EditTarget, TableEditPatch } from "./EditPopover";
import {
  applyPositionOverrides,
  computeErLayout,
  computeGroupBounds,
  computeRefPaths,
  DEFAULT_LAYOUT_CONFIG,
} from "./lib/erLayout";
import type { GroupBounds, PositionOverride, RefPath, RefSide, TableBox } from "./lib/erLayout";
import { getPalette } from "./lib/palette";
import type { ErPalette } from "./lib/palette";
import type { DbmlCardinality, DbmlColumn, DbmlSchema, DbmlTable } from "./lib/parser/types";

export interface ErDiagramDimensions {
  width: number;
  height: number;
}

export interface ErDiagramPreviewHandle {
  getSvgMarkup: () => string | null;
  getDimensions: () => ErDiagramDimensions | null;
}

interface ErDiagramPreviewProps {
  schema: DbmlSchema | null;
  errorMessage: string | null;
  onUpdateTable: (originalTableName: string, patch: TableEditPatch) => void;
  onUpdateColumn: (
    tableName: string,
    originalColumnName: string,
    patch: ColumnEditPatch,
  ) => void;
  onUpdateArea: (originalAreaName: string, patch: AreaEditPatch) => void;
  onDeleteArea: (areaName: string) => void;
  onCreateRef: (
    sourceTable: string,
    sourceColumn: string,
    targetTable: string,
    targetColumn: string,
  ) => void;
}

const ZOOM_STEP: number = 0.2;
const WHEEL_ZOOM_STEP: number = 0.1;
const MIN_ZOOM: number = 0.3;
const MAX_ZOOM: number = 2.5;
const DIAGRAM_MARGIN: number = 24;
const HEADER_HEIGHT: number = DEFAULT_LAYOUT_CONFIG.headerHeight;
const ROW_HEIGHT: number = DEFAULT_LAYOUT_CONFIG.rowHeight;
const CORNER_RADIUS: number = 8;
const DRAG_THRESHOLD_PX: number = 4;
const GRID_SIZE: number = 20;
const POSITIONS_STORAGE_KEY: string = "diagramas-dbml:positions";

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

function readStoredPositions(): Record<string, PositionOverride> {
  try {
    const raw: string | null = window.localStorage.getItem(POSITIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PositionOverride>) : {};
  } catch {
    return {};
  }
}

function roundedTopRectPath(width: number, height: number, radius: number): string {
  return `M0,${height} V${radius} Q0,0 ${radius},0 H${width - radius} Q${width},0 ${width},${radius} V${height} Z`;
}

interface EndpointMarkerProps {
  x: number;
  y: number;
  side: RefSide;
  cardinality: DbmlCardinality;
  palette: ErPalette;
}

/**
 * Dibuja la marca de cardinalidad (trazo simple para "uno", pata de cuervo
 * para "muchos") con el vértice anclado exactamente en el borde de la tabla
 * y abriéndose hacia la línea de conexión. Se dibuja a mano (en vez de usar
 * `<marker>` con `orient="auto"`) para controlar con certeza hacia qué lado
 * se abre.
 */
function EndpointMarker({
  x,
  y,
  side,
  cardinality,
  palette,
}: EndpointMarkerProps): React.JSX.Element {
  const direction: number = side === "right" ? 1 : -1;

  if (cardinality === "one") {
    const tickX: number = x + direction * 8;
    return (
      <line
        x1={tickX}
        y1={y - 5}
        x2={tickX}
        y2={y + 5}
        stroke={palette.relationLine}
        strokeWidth={1.5}
      />
    );
  }

  const footX: number = x + direction * 10;
  return (
    <g>
      <line x1={x} y1={y} x2={footX} y2={y - 5} stroke={palette.relationLine} strokeWidth={1.5} />
      <line x1={x} y1={y} x2={footX} y2={y + 5} stroke={palette.relationLine} strokeWidth={1.5} />
    </g>
  );
}

function RefConnector({
  path,
  palette,
}: {
  path: RefPath;
  palette: ErPalette;
}): React.JSX.Element {
  const horizontalDistance: number = Math.max(40, Math.abs(path.to.x - path.from.x) / 2);
  const control1X: number =
    path.fromSide === "right" ? path.from.x + horizontalDistance : path.from.x - horizontalDistance;
  const control2X: number =
    path.toSide === "right" ? path.to.x + horizontalDistance : path.to.x - horizontalDistance;
  const d: string = `M ${path.from.x} ${path.from.y} C ${control1X} ${path.from.y}, ${control2X} ${path.to.y}, ${path.to.x} ${path.to.y}`;

  return (
    <g>
      <path d={d} fill="none" stroke={palette.relationLine} strokeWidth={1.5} />
      <EndpointMarker
        x={path.from.x}
        y={path.from.y}
        side={path.fromSide}
        cardinality={path.ref.left.cardinality}
        palette={palette}
      />
      <EndpointMarker
        x={path.to.x}
        y={path.to.y}
        side={path.toSide}
        cardinality={path.ref.right.cardinality}
        palette={palette}
      />
    </g>
  );
}

interface TableBoxGroupProps {
  box: TableBox;
  palette: ErPalette;
  isSelected: boolean;
  onHeaderMouseDown: (table: DbmlTable, event: ReactMouseEvent<SVGGElement>) => void;
  onHeaderDoubleClick: (table: DbmlTable, event: ReactMouseEvent<SVGGElement>) => void;
  onColumnClick: (table: DbmlTable, column: DbmlColumn, event: ReactMouseEvent<SVGGElement>) => void;
  onColumnHandleMouseDown: (
    table: DbmlTable,
    column: DbmlColumn,
    event: ReactMouseEvent<SVGCircleElement>,
  ) => void;
}

const SELECTION_OUTLINE_COLOR: string = "#3b82f6";

function TableBoxGroup({
  box,
  palette,
  isSelected,
  onHeaderMouseDown,
  onHeaderDoubleClick,
  onColumnClick,
  onColumnHandleMouseDown,
}: TableBoxGroupProps): React.JSX.Element {
  const headerFill: string = box.table.headerColor ?? palette.headerBackground;

  return (
    <g transform={`translate(${box.x}, ${box.y})`}>
      <rect
        width={box.width}
        height={box.height}
        rx={CORNER_RADIUS}
        ry={CORNER_RADIUS}
        fill={palette.tableBackground}
        stroke={palette.tableBorder}
        strokeWidth={1}
      />
      {isSelected && (
        <rect
          x={-3}
          y={-3}
          width={box.width + 6}
          height={box.height + 6}
          rx={CORNER_RADIUS + 2}
          fill="none"
          stroke={SELECTION_OUTLINE_COLOR}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}

      <g
        className="cursor-move"
        onMouseDown={(event) => onHeaderMouseDown(box.table, event)}
        onDoubleClick={(event) => onHeaderDoubleClick(box.table, event)}
      >
        <path d={roundedTopRectPath(box.width, HEADER_HEIGHT, CORNER_RADIUS)} fill={headerFill} />
        <text
          x={10}
          y={HEADER_HEIGHT / 2}
          dominantBaseline="middle"
          fill={palette.headerText}
          fontSize={13}
          fontWeight={600}
        >
          {box.table.alias ?? box.table.name}
        </text>
      </g>

      {box.table.columns.map((column, index) => {
        const rowY: number = HEADER_HEIGHT + index * ROW_HEIGHT;
        const textY: number = rowY + ROW_HEIGHT / 2;

        return (
          <g
            key={column.name}
            className="cursor-pointer"
            data-column-row="true"
            data-table={box.table.name}
            data-column={column.name}
            onDoubleClick={(event) => onColumnClick(box.table, column, event)}
          >
            <rect x={0} y={rowY} width={box.width} height={ROW_HEIGHT} fill="transparent" />
            {index > 0 && (
              <line
                x1={0}
                y1={rowY}
                x2={box.width}
                y2={rowY}
                stroke={palette.rowDivider}
                strokeWidth={1}
              />
            )}
            {column.isPrimaryKey && (
              <text x={9} y={textY} dominantBaseline="middle" fontSize={11}>
                🔑
              </text>
            )}
            {!column.isPrimaryKey && column.isForeignKey && (
              <circle
                cx={14}
                cy={textY}
                r={3}
                fill="none"
                stroke={palette.foreignKeyAccent}
                strokeWidth={1.5}
              />
            )}
            <text
              x={26}
              y={textY}
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={column.isPrimaryKey ? 600 : 400}
              fill={palette.columnNameText}
            >
              {column.name}
            </text>
            <text
              x={box.width - 10}
              y={textY}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill={palette.columnTypeText}
            >
              {column.type}
            </text>
            <circle
              cx={0}
              cy={textY}
              r={4}
              fill={palette.relationLine}
              className="cursor-crosshair opacity-0 hover:opacity-100"
              onMouseDown={(event) => onColumnHandleMouseDown(box.table, column, event)}
            />
            <circle
              cx={box.width}
              cy={textY}
              r={4}
              fill={palette.relationLine}
              className="cursor-crosshair opacity-0 hover:opacity-100"
              onMouseDown={(event) => onColumnHandleMouseDown(box.table, column, event)}
            />
          </g>
        );
      })}
    </g>
  );
}

const DEFAULT_AREA_COLOR: string = "#0ea5e9";

function AreaBox({
  bounds,
  onMouseDown,
  onDoubleClick,
}: {
  bounds: GroupBounds;
  onMouseDown: (event: ReactMouseEvent<SVGGElement>) => void;
  onDoubleClick: (event: ReactMouseEvent<SVGGElement>) => void;
}): React.JSX.Element {
  const color: string = bounds.group.color ?? DEFAULT_AREA_COLOR;

  return (
    <g className="cursor-move" onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}>
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        rx={10}
        fill={color}
        fillOpacity={0.08}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <text x={bounds.x + 10} y={bounds.y + 16} fontSize={12} fontWeight={600} fill={color}>
        {bounds.group.name}
      </text>
    </g>
  );
}

interface DragState {
  tableName: string;
  startClientX: number;
  startClientY: number;
  startBoxX: number;
  startBoxY: number;
  hasMoved: boolean;
}

interface ConnectDragPoint {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

function normalizeRect(rect: MarqueeRect): { x: number; y: number; width: number; height: number } {
  const x = Math.min(rect.startX, rect.currentX);
  const y = Math.min(rect.startY, rect.currentY);
  return { x, y, width: Math.abs(rect.currentX - rect.startX), height: Math.abs(rect.currentY - rect.startY) };
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export const ErDiagramPreview = forwardRef<ErDiagramPreviewHandle, ErDiagramPreviewProps>(
  function ErDiagramPreview(
    { schema, errorMessage, onUpdateTable, onUpdateColumn, onUpdateArea, onDeleteArea, onCreateRef },
    ref,
  ) {
    const isDarkTheme: boolean = useIsDarkTheme();
    const palette: ErPalette = getPalette(isDarkTheme);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [zoom, setZoom] = useState<number>(1);
    const zoomRef = useRef<number>(zoom);
    const [positionOverrides, setPositionOverrides] = useState<Record<string, PositionOverride>>({});
    const dragStateRef = useRef<DragState | null>(null);
    const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
    const [editPosition, setEditPosition] = useState<{ x: number; y: number } | null>(null);
    const [connectDrag, setConnectDrag] = useState<ConnectDragPoint | null>(null);
    const [selectedTables, setSelectedTables] = useState<ReadonlySet<string>>(new Set());
    const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
    const [showGrid, setShowGrid] = useState<boolean>(false);

    useEffect(() => {
      zoomRef.current = zoom;
    }, [zoom]);

    /**
     * Ctrl/Cmd+rueda del mouse (o el gesto de pellizco de un trackpad, que el
     * navegador reporta como wheel con ctrlKey) debe hacer zoom solo sobre
     * este visor, no sobre la página completa. Se usa un listener nativo con
     * `{ passive: false }` en vez de `onWheel` de React porque React adjunta
     * su listener de wheel como pasivo por defecto, lo que impediría que
     * `preventDefault()` bloquee el zoom nativo del navegador.
     */
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      function handleWheel(event: WheelEvent): void {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        const direction: number = event.deltaY > 0 ? -1 : 1;
        setZoom((current) => {
          const next = Math.round((current + direction * WHEEL_ZOOM_STEP) * 100) / 100;
          return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
        });
      }

      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }, []);

    const showGridRef = useRef<boolean>(showGrid);
    useEffect(() => {
      showGridRef.current = showGrid;
    }, [showGrid]);

    useEffect(() => {
      const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
        setPositionOverrides(readStoredPositions());
      }, 0);
      return () => clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
      try {
        window.localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positionOverrides));
      } catch {
        // Almacenamiento no disponible: las posiciones no persisten entre recargas.
      }
    }, [positionOverrides]);

    const baseLayout = useMemo(() => (schema ? computeErLayout(schema) : null), [schema]);
    const layout = useMemo(
      () => (baseLayout ? applyPositionOverrides(baseLayout, positionOverrides) : null),
      [baseLayout, positionOverrides],
    );
    const refPaths = useMemo(
      () => (schema && layout ? computeRefPaths(schema, layout) : []),
      [schema, layout],
    );
    const groupBounds = useMemo(
      () => (schema && layout ? computeGroupBounds(schema.tableGroups, layout) : []),
      [schema, layout],
    );

    const contentWidth: number = Math.max(
      layout?.width ?? 0,
      ...groupBounds.map((bounds) => bounds.x + bounds.width),
    );
    const contentHeight: number = Math.max(
      layout?.height ?? 0,
      ...groupBounds.map((bounds) => bounds.y + bounds.height),
    );
    const canvasWidth: number = contentWidth + DIAGRAM_MARGIN * 2;
    const canvasHeight: number = contentHeight + DIAGRAM_MARGIN * 2;

    // El lienzo visible (y por tanto el área donde se puede iniciar una
    // selección por arrastre) debe cubrir siempre el 100% del contenedor,
    // aunque el contenido real (tablas agrupadas en una esquina) sea más
    // pequeño — si no, queda un espacio "muerto" sin fondo clickeable.
    const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
      width: 0,
      height: 0,
    });

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      // `offsetWidth`/`offsetHeight` (caja completa) en vez de `clientWidth`/
      // `clientHeight`: estos últimos se encogen en cuanto aparece la barra
      // de scroll, lo que recalcularía un lienzo más chico, ocultaría la
      // barra, volvería a agrandar el lienzo... un bucle infinito que
      // parpadea. offsetWidth/offsetHeight no cambian con la barra de scroll.
      const updateSize = (): void => {
        setViewportSize((current) => {
          const next = { width: container.offsetWidth, height: container.offsetHeight };
          return current.width === next.width && current.height === next.height ? current : next;
        });
      };
      updateSize();
      const observer: ResizeObserver = new ResizeObserver(updateSize);
      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    const minDisplayWidth: number = viewportSize.width / zoom;
    const minDisplayHeight: number = viewportSize.height / zoom;
    const displayWidth: number = Math.max(canvasWidth, minDisplayWidth);
    const displayHeight: number = Math.max(canvasHeight, minDisplayHeight);

    useImperativeHandle(
      ref,
      () => ({
        getSvgMarkup: (): string | null => {
          if (!svgRef.current) return null;
          const clone: SVGSVGElement = svgRef.current.cloneNode(true) as SVGSVGElement;
          clone.setAttribute("width", String(canvasWidth));
          clone.setAttribute("height", String(canvasHeight));
          clone.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
          return new XMLSerializer().serializeToString(clone);
        },
        getDimensions: (): ErDiagramDimensions | null => {
          if (!layout) return null;
          return { width: canvasWidth, height: canvasHeight };
        },
      }),
      [layout, canvasWidth, canvasHeight],
    );

    const openEditPopoverAt = useCallback((clientX: number, clientY: number, target: EditTarget): void => {
      const container = containerRef.current;
      if (!container) return;
      const rect: DOMRect = container.getBoundingClientRect();
      setEditPosition({
        x: clientX - rect.left + container.scrollLeft,
        y: clientY - rect.top + container.scrollTop,
      });
      setEditTarget(target);
    }, []);

    /** Convierte un punto de pantalla al sistema de coordenadas del contenido del diagrama (sin zoom, sin el margen). */
    const clientPointToContentPoint = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect: DOMRect = container.getBoundingClientRect();
      return {
        x: (clientX - rect.left + container.scrollLeft) / zoomRef.current - DIAGRAM_MARGIN,
        y: (clientY - rect.top + container.scrollTop) / zoomRef.current - DIAGRAM_MARGIN,
      };
    }, []);

    const activeDragListenersRef = useRef<{
      move: (event: MouseEvent) => void;
      up: (event: MouseEvent) => void;
    } | null>(null);

    /**
     * Mantener presionado el fondo del lienzo y arrastrar dibuja un
     * rectángulo de selección: al soltar, selecciona todas las tablas cuya
     * caja se cruce con ese rectángulo. Un clic sin arrastre en el fondo
     * limpia la selección.
     */
    const handleBackgroundMouseDown = useCallback(
      (event: ReactMouseEvent<SVGRectElement>): void => {
        if (event.button !== 0) return;
        const start = clientPointToContentPoint(event.clientX, event.clientY);
        if (!start) return;

        setEditTarget(null);
        let hasMoved: boolean = false;
        setMarqueeRect({ startX: start.x, startY: start.y, currentX: start.x, currentY: start.y });

        function handleMouseMove(moveEvent: MouseEvent): void {
          const point = clientPointToContentPoint(moveEvent.clientX, moveEvent.clientY);
          if (!point) return;
          if (!hasMoved && Math.hypot(point.x - start!.x, point.y - start!.y) > DRAG_THRESHOLD_PX) {
            hasMoved = true;
          }
          setMarqueeRect({ startX: start!.x, startY: start!.y, currentX: point.x, currentY: point.y });
        }

        function handleMouseUp(): void {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          activeDragListenersRef.current = null;

          setMarqueeRect((current) => {
            if (hasMoved && current) {
              const selectionBox = normalizeRect(current);
              const matches =
                layout?.tableBoxes.filter((box) => rectsIntersect(selectionBox, box)).map((box) => box.table.name) ??
                [];
              setSelectedTables(new Set(matches));
            } else {
              setSelectedTables(new Set());
            }
            return null;
          });
        }

        activeDragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      },
      [clientPointToContentPoint, layout],
    );

    const handleHeaderMouseDown = useCallback(
      (table: DbmlTable, event: ReactMouseEvent<SVGGElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        const box = layout?.tableBoxes.find((candidate) => candidate.table.name === table.name);
        if (!box) return;

        // Shift/Ctrl+clic agrega o quita esta tabla de la selección múltiple
        // sin moverla, para poder armar la selección con varios clics en
        // cualquier parte del lienzo en vez de un único arrastre rectangular.
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          setEditTarget(null);
          setSelectedTables((current) => {
            const next = new Set(current);
            if (next.has(table.name)) {
              next.delete(table.name);
            } else {
              next.add(table.name);
            }
            return next;
          });
          return;
        }

        // Arrastrar una tabla que forma parte de la selección actual mueve
        // a todas las seleccionadas juntas; arrastrar una tabla fuera de la
        // selección actúa solo sobre ella y limpia la selección anterior.
        const groupTableNames: string[] =
          selectedTables.has(table.name) && selectedTables.size > 1 ? [...selectedTables] : [table.name];
        if (groupTableNames.length === 1) setSelectedTables(new Set());

        const startPositions = new Map<string, { x: number; y: number }>();
        for (const tableName of groupTableNames) {
          const memberBox = layout?.tableBoxes.find((candidate) => candidate.table.name === tableName);
          if (memberBox) startPositions.set(tableName, { x: memberBox.x, y: memberBox.y });
        }

        // Los overrides se guardan en el espacio de coordenadas SIN desplazar
        // (ver `applyPositionOverrides`): hay que restar el desplazamiento
        // vigente al convertir la posición de pantalla a la posición a
        // guardar, para que no se acumule en cada render.
        const shiftX0: number = layout?.shiftX ?? 0;
        const shiftY0: number = layout?.shiftY ?? 0;

        const drag: DragState = {
          tableName: table.name,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startBoxX: box.x,
          startBoxY: box.y,
          hasMoved: false,
        };
        dragStateRef.current = drag;

        function handleMouseMove(moveEvent: MouseEvent): void {
          const dx: number = (moveEvent.clientX - drag.startClientX) / zoomRef.current;
          const dy: number = (moveEvent.clientY - drag.startClientY) / zoomRef.current;

          if (!drag.hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            drag.hasMoved = true;
          }

          if (drag.hasMoved) {
            setPositionOverrides((current) => {
              const next = { ...current };
              for (const [tableName, start] of startPositions) {
                const rawX: number = start.x + dx;
                const rawY: number = start.y + dy;
                const snappedX: number = showGridRef.current ? Math.round(rawX / GRID_SIZE) * GRID_SIZE : rawX;
                const snappedY: number = showGridRef.current ? Math.round(rawY / GRID_SIZE) * GRID_SIZE : rawY;
                next[tableName] = { x: snappedX - shiftX0, y: snappedY - shiftY0 };
              }
              return next;
            });
          }
        }

        function handleMouseUp(): void {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          activeDragListenersRef.current = null;
          dragStateRef.current = null;
        }

        activeDragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      },
      [layout, selectedTables],
    );

    const handleHeaderDoubleClick = useCallback(
      (table: DbmlTable, event: ReactMouseEvent<SVGGElement>): void => {
        const allAreas = schema?.tableGroups ?? [];
        const currentAreaName = allAreas.find((area) => area.tables.includes(table.name))?.name ?? null;
        openEditPopoverAt(event.clientX, event.clientY, {
          kind: "table",
          table,
          allAreas,
          currentAreaName,
        });
      },
      [schema, openEditPopoverAt],
    );

    useEffect(() => {
      return () => {
        const listeners = activeDragListenersRef.current;
        if (!listeners) return;
        window.removeEventListener("mousemove", listeners.move);
        window.removeEventListener("mouseup", listeners.up);
      };
    }, []);

    const handleColumnClick = useCallback(
      (table: DbmlTable, column: DbmlColumn, event: ReactMouseEvent<SVGGElement>): void => {
        openEditPopoverAt(event.clientX, event.clientY, { kind: "column", table, column });
      },
      [openEditPopoverAt],
    );

    /**
     * Arrastrar desde el pequeño círculo de conexión de una columna hasta
     * otra columna crea una relación entre ambas. Se busca el elemento bajo
     * el cursor en coordenadas de pantalla reales (`elementFromPoint`) en vez
     * de hacer la geometría a mano, porque así funciona sin importar el zoom
     * o el desplazamiento actual del contenedor.
     */
    const handleColumnHandleMouseDown = useCallback(
      (table: DbmlTable, column: DbmlColumn, event: ReactMouseEvent<SVGCircleElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        setEditTarget(null);

        const start = clientPointToContentPoint(event.clientX, event.clientY);
        if (!start) return;
        setConnectDrag({ fromX: start.x, fromY: start.y, toX: start.x, toY: start.y });

        function handleMouseMove(moveEvent: MouseEvent): void {
          const point = clientPointToContentPoint(moveEvent.clientX, moveEvent.clientY);
          if (!point) return;
          setConnectDrag((current) => (current ? { ...current, toX: point.x, toY: point.y } : current));
        }

        function handleMouseUp(upEvent: MouseEvent): void {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          activeDragListenersRef.current = null;
          setConnectDrag(null);

          const dropTarget = (document.elementFromPoint(upEvent.clientX, upEvent.clientY) as Element | null)?.closest(
            '[data-column-row="true"]',
          );
          if (!dropTarget) return;

          const targetTable = dropTarget.getAttribute("data-table");
          const targetColumn = dropTarget.getAttribute("data-column");
          if (!targetTable || !targetColumn) return;
          if (targetTable === table.name && targetColumn === column.name) return;

          onCreateRef(table.name, column.name, targetTable, targetColumn);
        }

        activeDragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      },
      [clientPointToContentPoint, onCreateRef],
    );

    const openAreaEditPopover = useCallback(
      (bounds: GroupBounds, clientX: number, clientY: number): void => {
        const allTableNames: string[] = schema?.tables.map((table) => table.name) ?? [];
        openEditPopoverAt(clientX, clientY, {
          kind: "area",
          group: bounds.group,
          allTableNames,
        });
      },
      [openEditPopoverAt, schema],
    );

    /** Arrastrar un área mueve a la vez a todas sus tablas miembro, conservando sus posiciones relativas. */
    const handleAreaMouseDown = useCallback(
      (bounds: GroupBounds, event: ReactMouseEvent<SVGGElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        setEditTarget(null);

        const memberTableNames: string[] = bounds.group.tables;
        const startPositions = new Map<string, { x: number; y: number }>();
        for (const tableName of memberTableNames) {
          const box = layout?.tableBoxes.find((candidate) => candidate.table.name === tableName);
          if (box) startPositions.set(tableName, { x: box.x, y: box.y });
        }

        const shiftX0: number = layout?.shiftX ?? 0;
        const shiftY0: number = layout?.shiftY ?? 0;

        const startClientX: number = event.clientX;
        const startClientY: number = event.clientY;
        let hasMoved: boolean = false;

        function handleMouseMove(moveEvent: MouseEvent): void {
          const dx: number = (moveEvent.clientX - startClientX) / zoomRef.current;
          const dy: number = (moveEvent.clientY - startClientY) / zoomRef.current;

          if (!hasMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            hasMoved = true;
          }
          if (!hasMoved || startPositions.size === 0) return;

          setPositionOverrides((current) => {
            const next = { ...current };
            for (const [tableName, start] of startPositions) {
              const rawX = start.x + dx;
              const rawY = start.y + dy;
              const snappedX: number = showGridRef.current ? Math.round(rawX / GRID_SIZE) * GRID_SIZE : rawX;
              const snappedY: number = showGridRef.current ? Math.round(rawY / GRID_SIZE) * GRID_SIZE : rawY;
              next[tableName] = { x: snappedX - shiftX0, y: snappedY - shiftY0 };
            }
            return next;
          });
        }

        function handleMouseUp(): void {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
          activeDragListenersRef.current = null;
        }

        activeDragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      },
      [layout],
    );

    const handleAreaDoubleClick = useCallback(
      (bounds: GroupBounds, event: ReactMouseEvent<SVGGElement>): void => {
        openAreaEditPopover(bounds, event.clientX, event.clientY);
      },
      [openAreaEditPopover],
    );

    const handleContainerClick = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
      if (event.target === containerRef.current || (event.target as Element).tagName === "svg") {
        setEditTarget(null);
      }
    }, []);

    const handleContainerContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
      event.preventDefault();
    }, []);

    const canZoomOut: boolean = zoom > MIN_ZOOM;
    const canZoomIn: boolean = zoom < MAX_ZOOM;
    const hasTables: boolean = !!schema && schema.tables.length > 0;
    const hasContent: boolean = hasTables || groupBounds.length > 0;

    return (
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        onContextMenu={handleContainerContextMenu}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
        className="no-scrollbar relative h-full min-h-80 w-full flex-1 overflow-auto rounded-xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-950"
      >
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-lg border border-black/[.08] bg-white/90 p-1 shadow-sm backdrop-blur-sm dark:border-white/[.145] dark:bg-zinc-900/90">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
            disabled={!canZoomOut}
            aria-label="Alejar"
            className="h-7 w-7 rounded-md text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[.08]"
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
            className="h-7 w-7 rounded-md text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[.08]"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.08]"
          >
            Restablecer
          </button>
          <div className="mx-0.5 h-5 w-px bg-black/[.08] dark:bg-white/[.145]" />
          <button
            type="button"
            onClick={() => setShowGrid((current) => !current)}
            aria-pressed={showGrid}
            title="Mostrar u ocultar la cuadrícula"
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.08] ${
              showGrid ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Cuadrícula
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="m-4 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {!errorMessage && !hasContent && (
          <p className="m-4 text-sm text-zinc-500 dark:text-zinc-400">
            Escribe DBML para ver aquí el diagrama.
          </p>
        )}

        {!errorMessage && hasContent && layout && (
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              width={displayWidth}
              height={displayHeight}
              viewBox={`0 0 ${displayWidth} ${displayHeight}`}
            >
              {showGrid && (
                <defs>
                  <pattern
                    id="er-grid-pattern"
                    width={GRID_SIZE}
                    height={GRID_SIZE}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                      fill="none"
                      stroke={palette.gridLine}
                      strokeWidth={1}
                    />
                  </pattern>
                </defs>
              )}
              <rect
                width="100%"
                height="100%"
                fill={palette.canvasBackground}
                onMouseDown={handleBackgroundMouseDown}
              />
              {showGrid && (
                <rect width="100%" height="100%" fill="url(#er-grid-pattern)" pointerEvents="none" />
              )}
              <g transform={`translate(${DIAGRAM_MARGIN}, ${DIAGRAM_MARGIN})`}>
                {groupBounds.map((bounds) => (
                  <AreaBox
                    key={bounds.group.name}
                    bounds={bounds}
                    onMouseDown={(event) => handleAreaMouseDown(bounds, event)}
                    onDoubleClick={(event) => handleAreaDoubleClick(bounds, event)}
                  />
                ))}
                {refPaths.map((path) => (
                  <RefConnector
                    key={`${path.ref.left.table}.${path.ref.left.column}->${path.ref.right.table}.${path.ref.right.column}`}
                    path={path}
                    palette={palette}
                  />
                ))}
                {layout.tableBoxes.map((box) => (
                  <TableBoxGroup
                    key={box.table.name}
                    box={box}
                    palette={palette}
                    isSelected={selectedTables.has(box.table.name)}
                    onHeaderMouseDown={handleHeaderMouseDown}
                    onHeaderDoubleClick={handleHeaderDoubleClick}
                    onColumnClick={handleColumnClick}
                    onColumnHandleMouseDown={handleColumnHandleMouseDown}
                  />
                ))}
                {marqueeRect && (
                  <rect
                    {...normalizeRect(marqueeRect)}
                    fill={SELECTION_OUTLINE_COLOR}
                    fillOpacity={0.1}
                    stroke={SELECTION_OUTLINE_COLOR}
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}
                {connectDrag && (
                  <line
                    x1={connectDrag.fromX}
                    y1={connectDrag.fromY}
                    x2={connectDrag.toX}
                    y2={connectDrag.toY}
                    stroke={palette.foreignKeyAccent}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    pointerEvents="none"
                  />
                )}
              </g>
            </svg>
          </div>
        )}

        {editTarget && editPosition && (
          <EditPopover
            key={buildEditTargetKey(editTarget)}
            target={editTarget}
            x={editPosition.x}
            y={editPosition.y}
            onClose={() => setEditTarget(null)}
            onApplyTable={(originalName, patch) => {
              onUpdateTable(originalName, patch);
              setEditTarget(null);
            }}
            onApplyColumn={(tableName, originalColumnName, patch) => {
              onUpdateColumn(tableName, originalColumnName, patch);
              setEditTarget(null);
            }}
            onApplyArea={(originalAreaName, patch) => {
              onUpdateArea(originalAreaName, patch);
              setEditTarget(null);
            }}
            onDeleteArea={(areaName) => {
              onDeleteArea(areaName);
              setEditTarget(null);
            }}
          />
        )}
      </div>
    );
  },
);
