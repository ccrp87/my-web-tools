import { makeLocalDate, toISODate } from "./dates";

export interface CalendarDayCell {
  key: string;
  day: number | null;
  iso: string | null;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | undefined;
  isSelected: boolean;
  isToday: boolean;
}

/** Encabezados de semana empezando en lunes, como se usa en Colombia. */
const WEEKDAY_LABELS: readonly string[] = ["L", "M", "M", "J", "V", "S", "D"];

export function getWeekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS;
}

export function shiftMonth(monthStart: Date, amount: number): Date {
  return makeLocalDate(
    monthStart.getFullYear(),
    monthStart.getMonth() + amount,
    1,
  );
}

/** Celdas de un mes para un selector de fecha, con relleno inicial para alinear la semana en lunes. */
export function buildMonthDayCells(
  monthStart: Date,
  holidays: ReadonlyMap<string, string>,
  selectedISO: string | null,
  todayISO: string,
): CalendarDayCell[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const totalDays = makeLocalDate(year, month + 1, 0).getDate();
  const leadingBlanks = (makeLocalDate(year, month, 1).getDay() + 6) % 7;

  const cells: CalendarDayCell[] = Array.from(
    { length: leadingBlanks },
    (_, index) => ({
      key: `blank-${index}`,
      day: null,
      iso: null,
      isWeekend: false,
      isHoliday: false,
      holidayName: undefined,
      isSelected: false,
      isToday: false,
    }),
  );

  for (let day = 1; day <= totalDays; day += 1) {
    const date = makeLocalDate(year, month, day);
    const iso = toISODate(date);
    const weekday = date.getDay();
    cells.push({
      key: iso,
      day,
      iso,
      isWeekend: weekday === 0 || weekday === 6,
      isHoliday: holidays.has(iso),
      holidayName: holidays.get(iso),
      isSelected: iso === selectedISO,
      isToday: iso === todayISO,
    });
  }

  return cells;
}
