"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMonthDayCells,
  getWeekdayLabels,
  shiftMonth,
} from "./lib/calendarGrid";
import { makeLocalDate, parseISODate, toISODate, todayLocalDate } from "./lib/dates";
import { formatLongDate, formatMonthYear } from "./lib/format";

interface DatePickerProps {
  id: string;
  label: string;
  value: string;
  holidays: ReadonlyMap<string, string>;
  onChange: (iso: string) => void;
}

export function DatePicker({
  id,
  label,
  value,
  holidays,
  onChange,
}: DatePickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const selectedDate = useMemo(() => parseISODate(value), [value]);
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    makeLocalDate(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const openPicker = (): void => {
    setViewMonth(
      makeLocalDate(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const todayISO = toISODate(todayLocalDate());
  const cells = buildMonthDayCells(viewMonth, holidays, value, todayISO);

  const handleSelect = (iso: string): void => {
    onChange(iso);
    setIsOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-black dark:text-zinc-50"
      >
        {label}
      </label>

      <button
        type="button"
        id={id}
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex items-center justify-between gap-2 rounded-lg border border-black/[.15] bg-transparent px-3 py-2 text-left text-sm text-black outline-none focus-visible:border-black dark:border-white/[.2] dark:text-zinc-50 dark:focus-visible:border-white"
      >
        <span>{formatLongDate(selectedDate)}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
        >
          <rect
            x="2.5"
            y="4"
            width="15"
            height="13.5"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M2.5 8h15" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 2.5v3M14 2.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Elegir fecha"
          className="absolute top-full left-0 z-10 mt-2 w-72 rounded-xl border border-black/[.08] bg-zinc-50 p-3 shadow-lg dark:border-white/[.145] dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((month) => shiftMonth(month, -1))}
              aria-label="Mes anterior"
              className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-black dark:text-zinc-50">
              {formatMonthYear(viewMonth)}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((month) => shiftMonth(month, 1))}
              aria-label="Mes siguiente"
              className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {getWeekdayLabels().map((weekdayLabel, index) => (
              <div
                key={`wd-${index}`}
                className="pb-1 text-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
              >
                {weekdayLabel}
              </div>
            ))}

            {cells.map((cell) => (
              <button
                type="button"
                key={cell.key}
                disabled={cell.day === null}
                title={cell.holidayName}
                onClick={() => cell.iso && handleSelect(cell.iso)}
                className={`relative flex aspect-square items-center justify-center rounded-sm text-xs transition-colors ${
                  cell.day === null
                    ? "cursor-default"
                    : cell.isSelected
                      ? "bg-black font-semibold text-white dark:bg-white dark:text-black"
                      : cell.isHoliday
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
                        : cell.isWeekend
                          ? "text-zinc-400 hover:bg-black/[.04] dark:text-zinc-500 dark:hover:bg-white/[.08]"
                          : "text-black hover:bg-black/[.04] dark:text-zinc-50 dark:hover:bg-white/[.08]"
                } ${cell.isToday && !cell.isSelected ? "ring-1 ring-inset ring-black dark:ring-white" : ""}`}
              >
                {cell.day}
                {cell.isHoliday && !cell.isSelected && (
                  <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-amber-700 dark:bg-amber-300" />
                )}
              </button>
            ))}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-700 dark:bg-amber-300" />
            Festivo en Colombia
          </p>
        </div>
      )}
    </div>
  );
}
