"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  beforeAlt: string;
  afterSrc: string;
  afterAlt: string;
}

const KEYBOARD_STEP_PERCENTAGE: number = 5;

const TRANSPARENCY_GRID_TILE_PX: number = 12;
const TRANSPARENCY_GRID_HALF_TILE_PX: number = TRANSPARENCY_GRID_TILE_PX / 2;

const TRANSPARENCY_GRID_STYLE: React.CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage: [
    "linear-gradient(45deg, #e5e5e5 25%, transparent 25%)",
    "linear-gradient(-45deg, #e5e5e5 25%, transparent 25%)",
    "linear-gradient(45deg, transparent 75%, #e5e5e5 75%)",
    "linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
  ].join(", "),
  backgroundSize: `${TRANSPARENCY_GRID_TILE_PX}px ${TRANSPARENCY_GRID_TILE_PX}px`,
  backgroundPosition: [
    "0 0",
    `0 ${TRANSPARENCY_GRID_HALF_TILE_PX}px`,
    `${TRANSPARENCY_GRID_HALF_TILE_PX}px -${TRANSPARENCY_GRID_HALF_TILE_PX}px`,
    `-${TRANSPARENCY_GRID_HALF_TILE_PX}px 0px`,
  ].join(", "),
};

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function BeforeAfterSlider({
  beforeSrc,
  beforeAlt,
  afterSrc,
  afterAlt,
}: BeforeAfterSliderProps): React.JSX.Element {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const updateFromClientX = useCallback((clientX: number): void => {
    const container: HTMLDivElement | null = containerRef.current;
    if (!container) {
      return;
    }
    const rect: DOMRect = container.getBoundingClientRect();
    const ratio: number = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(clampPercentage(ratio));
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      isDraggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>): void => {
      if (!isDraggingRef.current) {
        return;
      }
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerUp = useCallback((): void => {
    isDraggingRef.current = false;
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          setSliderPosition((current) =>
            clampPercentage(current - KEYBOARD_STEP_PERCENTAGE),
          );
          break;
        case "ArrowRight":
          event.preventDefault();
          setSliderPosition((current) =>
            clampPercentage(current + KEYBOARD_STEP_PERCENTAGE),
          );
          break;
        case "Home":
          event.preventDefault();
          setSliderPosition(0);
          break;
        case "End":
          event.preventDefault();
          setSliderPosition(100);
          break;
        default:
          break;
      }
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-black/[.08] cursor-ew-resize dark:border-white/[.145]"
    >
      <img
        src={beforeSrc}
        alt={beforeAlt}
        draggable={false}
        className="block w-full h-auto"
      />

      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
      >
        <div className="absolute inset-0" style={TRANSPARENCY_GRID_STYLE} />
        <img
          src={afterSrc}
          alt={afterAlt}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      <div
        className="absolute inset-y-0"
        style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
      >
        <div className="h-full w-0.5 bg-white shadow" />
        <div
          role="slider"
          aria-label="Comparar imagen original y sin fondo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/[.08] bg-white shadow focus:outline-2 focus:outline-offset-2 focus:outline-foreground dark:border-white/[.145] dark:bg-zinc-900"
        >
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-700 dark:text-zinc-300"
          >
            <path d="M13 5L7 12L13 19" />
            <path d="M11 5L17 12L11 19" />
          </svg>
        </div>
      </div>
    </div>
  );
}
