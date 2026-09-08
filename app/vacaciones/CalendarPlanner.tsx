import { addDays, makeLocalDate, toISODate, todayLocalDate } from "./lib/dates";
import { formatMonthYear } from "./lib/format";
import { isWorkday, type VacationPlan } from "./lib/planner";
import { weekOverlapsHighSeason, type SeasonWindow } from "./lib/temporadas";

interface CalendarPlannerProps {
  plan: VacationPlan;
  holidays: ReadonlyMap<string, string>;
  seasonWindows: readonly SeasonWindow[];
}

const WEEKDAY_LABELS: readonly string[] = ["L", "M", "M", "J", "V", "S", "D"];
const MAX_MONTHS_SHOWN = 5;
const DAYS_PER_WEEK = 7;

interface DayCell {
  key: string;
  day: number | null;
  iso: string | null;
  isInRest: boolean;
  isWorkdaySpent: boolean;
  isHoliday: boolean;
  holidayName: string | undefined;
  isToday: boolean;
}

interface WeekRow {
  key: string;
  monday: Date;
  cells: DayCell[];
}

function buildMonthWeeks(
  monthStart: Date,
  plan: VacationPlan,
  holidays: ReadonlyMap<string, string>,
  todayISO: string,
): WeekRow[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const totalDays = makeLocalDate(year, month + 1, 0).getDate();
  const leadingBlanks = (makeLocalDate(year, month, 1).getDay() + 6) % 7;
  const firstGridMonday = addDays(makeLocalDate(year, month, 1), -leadingBlanks);

  const cells: DayCell[] = Array.from({ length: leadingBlanks }, (_, index) => ({
    key: `blank-${index}`,
    day: null,
    iso: null,
    isInRest: false,
    isWorkdaySpent: false,
    isHoliday: false,
    holidayName: undefined,
    isToday: false,
  }));

  for (let day = 1; day <= totalDays; day += 1) {
    const date = makeLocalDate(year, month, day);
    const iso = toISODate(date);
    const isInRest = date >= plan.restStart && date <= plan.restEnd;
    cells.push({
      key: iso,
      day,
      iso,
      isInRest,
      isWorkdaySpent: isInRest && isWorkday(date, holidays),
      isHoliday: holidays.has(iso),
      holidayName: holidays.get(iso),
      isToday: iso === todayISO,
    });
  }

  const trailingBlanks = (DAYS_PER_WEEK - (cells.length % DAYS_PER_WEEK)) % DAYS_PER_WEEK;
  for (let index = 0; index < trailingBlanks; index += 1) {
    cells.push({
      key: `blank-end-${index}`,
      day: null,
      iso: null,
      isInRest: false,
      isWorkdaySpent: false,
      isHoliday: false,
      holidayName: undefined,
      isToday: false,
    });
  }

  const weeks: WeekRow[] = [];
  for (let index = 0; index < cells.length; index += DAYS_PER_WEEK) {
    const weekIndex = index / DAYS_PER_WEEK;
    weeks.push({
      key: `week-${weekIndex}`,
      monday: addDays(firstGridMonday, weekIndex * DAYS_PER_WEEK),
      cells: cells.slice(index, index + DAYS_PER_WEEK),
    });
  }

  return weeks;
}

export function CalendarPlanner({
  plan,
  holidays,
  seasonWindows,
}: CalendarPlannerProps): React.JSX.Element {
  const todayISO = toISODate(todayLocalDate());
  const firstMonth = makeLocalDate(
    plan.restStart.getFullYear(),
    plan.restStart.getMonth(),
    1,
  );
  const lastMonth = makeLocalDate(
    plan.restEnd.getFullYear(),
    plan.restEnd.getMonth(),
    1,
  );
  const monthsSpan = Math.min(
    (lastMonth.getFullYear() - firstMonth.getFullYear()) * 12 +
      (lastMonth.getMonth() - firstMonth.getMonth()),
    MAX_MONTHS_SHOWN,
  );

  const months = Array.from({ length: monthsSpan + 1 }, (_, index) =>
    makeLocalDate(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1),
  );

  const hasSeasonWindows = seasonWindows.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {months.map((month) => {
          const weeks = buildMonthWeeks(month, plan, holidays, todayISO);
          return (
            <div
              key={toISODate(month)}
              className="min-w-[13rem] flex-1 rounded-xl border border-black/[.08] p-3 dark:border-white/[.145]"
            >
              <h3 className="mb-2 text-xs font-semibold text-black dark:text-zinc-50">
                {formatMonthYear(month)}
              </h3>
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAY_LABELS.map((label, index) => (
                  <div
                    key={`wd-${index}`}
                    className="pb-1 text-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-0.5">
                {weeks.map((week) => {
                  const isHighSeasonWeek =
                    hasSeasonWindows && weekOverlapsHighSeason(week.monday, seasonWindows);
                  return (
                    <div
                      key={week.key}
                      className={`rounded-sm pb-1 ${
                        isHighSeasonWeek
                          ? "border-b-2 border-indigo-500 dark:border-indigo-400"
                          : ""
                      }`}
                    >
                      <div className="grid grid-cols-7 gap-0.5">
                        {week.cells.map((cell) => (
                          <div
                            key={cell.key}
                            title={cell.holidayName}
                            className={`relative flex aspect-square items-center justify-center rounded-sm text-xs ${
                              cell.day === null
                                ? ""
                                : cell.isWorkdaySpent
                                  ? "bg-amber-500 font-semibold text-amber-950"
                                  : cell.isInRest
                                    ? "bg-amber-100 font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                    : "bg-black/[.02] text-zinc-500 dark:bg-white/[.04] dark:text-zinc-400"
                            } ${cell.isToday ? "ring-1 ring-inset ring-black dark:ring-white" : ""}`}
                          >
                            {cell.day}
                            {cell.isHoliday && (
                              <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-amber-700 dark:bg-amber-300" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
          Día que gastas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100 dark:bg-amber-900" />
          Descanso gratis
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm border border-black/[.15] bg-transparent dark:border-white/[.2]" />
          Día normal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-full bg-amber-700 dark:bg-amber-300" />
          El punto marca festivo
        </span>
        {hasSeasonWindows && (
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 border-b-2 border-indigo-500 dark:border-indigo-400" />
            La banda marca semana en temporada alta
          </span>
        )}
      </p>
    </div>
  );
}
