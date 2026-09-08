import { addDays } from "./lib/dates";
import { formatLongDate, formatShortDate } from "./lib/format";
import { firstWorkdayOnOrAfter, isWorkday, type VacationPlan } from "./lib/planner";

interface ResultSummaryProps {
  plan: VacationPlan | null;
  holidays: ReadonlyMap<string, string>;
}

interface Metric {
  key: string;
  value: number;
  label: string;
}

export function ResultSummary({
  plan,
  holidays,
}: ResultSummaryProps): React.JSX.Element {
  if (!plan) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Te reincorporas el
        </p>
        <p className="text-3xl font-light text-black dark:text-zinc-50">—</p>
      </div>
    );
  }

  const metrics: Metric[] = [
    {
      key: "spent",
      value: plan.spent,
      label: "días hábiles descontados",
    },
    {
      key: "calendar",
      value: plan.calendarDays,
      label: "días calendario de vacaciones",
    },
    {
      key: "rest",
      value: plan.restDays,
      label: "días seguidos sin trabajar",
    },
    {
      key: "free",
      value: plan.restDays - plan.spent,
      label: "de ellos, gratis",
    },
  ];

  const flags: string[] = [];
  if (plan.startsOnNonWorkday) {
    const nextWorkday = firstWorkdayOnOrAfter(addDays(plan.start, 1), holidays);
    flags.push(
      isWorkday(plan.start, holidays)
        ? ""
        : `El ${formatShortDate(plan.start)} no es día hábil, así que no te descuentan nada por él. Tu primer día hábil de vacaciones sería el ${formatShortDate(nextWorkday)}.`,
    );
  }
  if (plan.hits.length > 0) {
    const holidaysList = plan.hits
      .map((hit) => `${hit.name} (${formatShortDate(hit.date)})`)
      .join(", ");
    flags.push(
      `Caen ${plan.hits.length} ${plan.hits.length === 1 ? "festivo" : "festivos"} dentro del periodo: ${holidaysList}.`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Te reincorporas el
        </p>
        <p className="text-3xl font-light leading-tight text-black sm:text-4xl dark:text-zinc-50">
          <span className="font-medium">
            {formatLongDate(plan.back).split(" ")[0]}
          </span>{" "}
          {formatLongDate(plan.back).split(" ").slice(1).join(" ")}
        </p>
      </div>

      <div className="flex flex-wrap divide-x divide-black/[.08] border-y border-black/[.08] dark:divide-white/[.145] dark:border-white/[.145]">
        {metrics.map((metric) => (
          <div key={metric.key} className="min-w-[7rem] flex-1 py-3 pr-4 first:pl-0">
            <span className="block text-xl font-semibold text-black dark:text-zinc-50">
              {metric.value}
            </span>
            <span className="block max-w-[15ch] text-xs text-zinc-500 dark:text-zinc-400">
              {metric.label}
            </span>
          </div>
        ))}
      </div>

      {flags.filter(Boolean).length > 0 && (
        <div className="flex flex-col gap-2">
          {flags.filter(Boolean).map((flag) => (
            <p
              key={flag}
              className="rounded-r-lg border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              {flag}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
