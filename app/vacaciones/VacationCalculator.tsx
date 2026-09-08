"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarPlanner } from "./CalendarPlanner";
import { HolidaysEditor } from "./HolidaysEditor";
import { RequestText } from "./RequestText";
import { ResultSummary } from "./ResultSummary";
import { SuggestionsTable } from "./SuggestionsTable";
import { VacationForm } from "./VacationForm";
import { parseISODate, toISODate, todayLocalDate } from "./lib/dates";
import { buildHolidayMap } from "./lib/holidays";
import {
  buildVacationPlan,
  suggestBetterStartDates,
  type VacationCountMode,
} from "./lib/planner";

const DEFAULT_DAYS = 15;

export function VacationCalculator(): React.JSX.Element {
  const [startISO, setStartISO] = useState<string>(() =>
    toISODate(todayLocalDate()),
  );
  const [days, setDays] = useState<number | null>(DEFAULT_DAYS);
  const [mode, setMode] = useState<VacationCountMode>("habiles");
  const [removedHolidays, setRemovedHolidays] = useState<Set<string>>(
    () => new Set(),
  );
  const [addedHolidays, setAddedHolidays] = useState<Map<string, string>>(
    () => new Map(),
  );

  const holidays = useMemo(
    () =>
      buildHolidayMap(
        parseISODate(startISO).getFullYear(),
        removedHolidays,
        addedHolidays,
      ),
    [startISO, removedHolidays, addedHolidays],
  );

  const plan = useMemo(() => {
    if (!startISO || days === null) return null;
    return buildVacationPlan(startISO, days, mode, holidays);
  }, [startISO, days, mode, holidays]);

  const suggestions = useMemo(() => {
    if (!plan || days === null) return [];
    const currentISO = toISODate(plan.start);
    return suggestBetterStartDates(startISO, days, mode, holidays, plan).filter(
      (candidate) =>
        toISODate(candidate.start) === currentISO ||
        candidate.restDays >= plan.restDays,
    );
  }, [plan, startISO, days, mode, holidays]);

  const handleRemoveHoliday = useCallback((iso: string): void => {
    setAddedHolidays((previous) => {
      const next = new Map(previous);
      next.delete(iso);
      return next;
    });
    setRemovedHolidays((previous) => new Set(previous).add(iso));
  }, []);

  const handleAddHoliday = useCallback((iso: string, name: string): void => {
    setRemovedHolidays((previous) => {
      const next = new Set(previous);
      next.delete(iso);
      return next;
    });
    setAddedHolidays((previous) => new Map(previous).set(iso, name));
  }, []);

  return (
    <div className="flex w-full flex-col gap-10">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <VacationForm
          startISO={startISO}
          days={days}
          mode={mode}
          holidays={holidays}
          onStartChange={setStartISO}
          onDaysChange={setDays}
          onModeChange={setMode}
        />
        <ResultSummary plan={plan} holidays={holidays} />
      </div>

      {plan && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              Tus días en el calendario
            </h2>
            <p className="max-w-[62ch] text-sm text-zinc-600 dark:text-zinc-400">
              En oro fuerte los días que descuentan de tus vacaciones. En oro
              claro los que te salen gratis porque ya eran fin de semana o
              festivo.
            </p>
          </div>
          <CalendarPlanner plan={plan} holidays={holidays} />
        </section>
      )}

      {plan && suggestions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">
            Mejores fechas para empezar
          </h2>
          <SuggestionsTable
            plan={plan}
            suggestions={suggestions}
            onSelectStart={setStartISO}
          />
        </section>
      )}

      {plan && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              Texto para tu solicitud
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Copia esto en el correo o el formulario de recursos humanos.
            </p>
          </div>
          <RequestText plan={plan} />
        </section>
      )}

      <section>
        <HolidaysEditor
          holidays={holidays}
          referenceYear={parseISODate(startISO).getFullYear()}
          plan={plan}
          onRemove={handleRemoveHoliday}
          onAdd={handleAddHoliday}
        />
      </section>

      <footer className="max-w-[70ch] border-t border-black/[.08] pt-4 text-xs text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
        El cálculo asume semana laboral de lunes a viernes. En Colombia las
        vacaciones legales son 15 días hábiles por año trabajado y los
        sábados no se descuentan; si tu contrato dice otra cosa, cambia el
        modo de conteo. Verifica siempre el resultado con recursos humanos
        antes de radicar la solicitud.
      </footer>
    </div>
  );
}
