import { toISODate } from "./lib/dates";
import { formatShortDate } from "./lib/format";
import type { VacationPlan } from "./lib/planner";

interface SuggestionsTableProps {
  plan: VacationPlan;
  suggestions: VacationPlan[];
  onSelectStart: (iso: string) => void;
}

export function SuggestionsTable({
  plan,
  suggestions,
  onSelectStart,
}: SuggestionsTableProps): React.JSX.Element {
  const currentISO = toISODate(plan.start);
  const bestScore = suggestions.reduce(
    (best, candidate) => Math.max(best, candidate.score),
    0,
  );
  const isCurrentAlreadyBest =
    suggestions.find((candidate) => toISODate(candidate.start) === currentISO)
      ?.score === bestScore;

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[62ch] text-sm text-zinc-600 dark:text-zinc-400">
        {isCurrentAlreadyBest
          ? "La fecha que elegiste ya es la que mejor aprovecha los puentes en los próximos meses."
          : "Empezando unos días después aprovechas festivos y fines de semana, gastando los mismos días de vacaciones."}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-black py-0 pr-3 pb-2 text-left text-xs font-medium text-zinc-500 dark:border-white dark:text-zinc-400">
                Empiezas
              </th>
              <th className="border-b border-black py-0 pr-3 pb-2 text-left text-xs font-medium text-zinc-500 dark:border-white dark:text-zinc-400">
                Regresas
              </th>
              <th className="hidden border-b border-black py-0 pr-3 pb-2 text-left text-xs font-medium text-zinc-500 sm:table-cell dark:border-white dark:text-zinc-400">
                Reparto
              </th>
              <th className="border-b border-black py-0 pr-3 pb-2 text-left text-xs font-medium text-zinc-500 dark:border-white dark:text-zinc-400">
                Descanso seguido
              </th>
              <th className="border-b border-black py-0 pb-2 dark:border-white" />
            </tr>
          </thead>
          <tbody>
            {suggestions.map((candidate) => {
              const isCurrent = toISODate(candidate.start) === currentISO;
              const gain = candidate.restDays - plan.restDays;
              const free = candidate.restDays - candidate.spent;

              return (
                <tr
                  key={toISODate(candidate.start)}
                  className={isCurrent ? "bg-black/[.02] dark:bg-white/[.04]" : ""}
                >
                  <td className="border-b border-black/[.08] py-3 pr-3 align-top dark:border-white/[.145]">
                    {formatShortDate(candidate.start)}
                    <br />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {candidate.spent} hábiles
                    </span>
                  </td>
                  <td className="border-b border-black/[.08] py-3 pr-3 align-top dark:border-white/[.145]">
                    {formatShortDate(candidate.back)}
                  </td>
                  <td className="hidden min-w-[6rem] border-b border-black/[.08] py-3 pr-3 align-top sm:table-cell dark:border-white/[.145]">
                    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <i
                        className="block h-full bg-amber-500"
                        style={{ flex: candidate.spent }}
                      />
                      <i
                        className="block h-full bg-amber-100 dark:bg-amber-900"
                        style={{ flex: Math.max(free, 0) }}
                      />
                    </div>
                  </td>
                  <td className="border-b border-black/[.08] py-3 pr-3 align-top dark:border-white/[.145]">
                    <b>{candidate.restDays} días</b>
                    <br />
                    {isCurrent ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        tu fecha
                      </span>
                    ) : gain > 0 ? (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        +{gain} {gain === 1 ? "día" : "días"}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {gain === 0 ? "igual" : `${gain} días`}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-black/[.08] py-3 align-top dark:border-white/[.145]">
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => onSelectStart(toISODate(candidate.start))}
                        className="whitespace-nowrap rounded-full border border-black px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black hover:text-white dark:border-white dark:text-zinc-50 dark:hover:bg-white dark:hover:text-black"
                      >
                        Usar esta
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
