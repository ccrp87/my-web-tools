"use client";

import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatTimestamp } from "./utils";

type Handle = "start" | "end";

interface TrimTimelineProps {
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  onChange: (startSeconds: number, endSeconds: number) => void;
}

export function TrimTimeline({
  durationSeconds,
  startSeconds,
  endSeconds,
  onChange,
}: TrimTimelineProps): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingHandleRef = useRef<Handle | null>(null);

  const timeFromClientX = useCallback(
    (clientX: number): number => {
      const track: HTMLDivElement | null = trackRef.current;
      if (!track || durationSeconds <= 0) {
        return 0;
      }
      const rect: DOMRect = track.getBoundingClientRect();
      const ratio: number = (clientX - rect.left) / rect.width;
      return Math.min(durationSeconds, Math.max(0, ratio * durationSeconds));
    },
    [durationSeconds],
  );

  const handlePointerDown = useCallback(
    (handle: Handle) =>
      (event: ReactPointerEvent<HTMLDivElement>): void => {
        event.currentTarget.setPointerCapture(event.pointerId);
        draggingHandleRef.current = handle;
      },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const handle: Handle | null = draggingHandleRef.current;
      if (!handle) {
        return;
      }
      const time: number = timeFromClientX(event.clientX);
      if (handle === "start") {
        onChange(time, endSeconds);
      } else {
        onChange(startSeconds, time);
      }
    },
    [timeFromClientX, onChange, startSeconds, endSeconds],
  );

  const handlePointerUp = useCallback((): void => {
    draggingHandleRef.current = null;
  }, []);

  const startPercentage: number =
    durationSeconds > 0 ? (startSeconds / durationSeconds) * 100 : 0;
  const endPercentage: number =
    durationSeconds > 0 ? (endSeconds / durationSeconds) * 100 : 100;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        className="relative h-2 w-full touch-none rounded-full bg-black/[.08] dark:bg-white/[.145]"
      >
        <div
          className="absolute h-full rounded-full bg-foreground"
          style={{
            left: `${Math.min(startPercentage, endPercentage)}%`,
            width: `${Math.abs(endPercentage - startPercentage)}%`,
          }}
        />
        <div
          role="slider"
          aria-label="Inicio del recorte"
          aria-valuemin={0}
          aria-valuemax={durationSeconds}
          aria-valuenow={startSeconds}
          tabIndex={0}
          onPointerDown={handlePointerDown("start")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ left: `${startPercentage}%` }}
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-black/[.15] bg-white shadow focus:outline-2 focus:outline-offset-2 focus:outline-foreground dark:border-white/[.2] dark:bg-zinc-900"
        />
        <div
          role="slider"
          aria-label="Fin del recorte"
          aria-valuemin={0}
          aria-valuemax={durationSeconds}
          aria-valuenow={endSeconds}
          tabIndex={0}
          onPointerDown={handlePointerDown("end")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ left: `${endPercentage}%` }}
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-black/[.15] bg-white shadow focus:outline-2 focus:outline-offset-2 focus:outline-foreground dark:border-white/[.2] dark:bg-zinc-900"
        />
      </div>
      <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>Inicio: {formatTimestamp(startSeconds)}</span>
        <span>Duración total: {formatTimestamp(durationSeconds)}</span>
        <span>Fin: {formatTimestamp(endSeconds)}</span>
      </div>
    </div>
  );
}
