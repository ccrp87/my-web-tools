"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarPlanner } from "./CalendarPlanner";
import { HolidaysEditor } from "./HolidaysEditor";
import { RequestText } from "./RequestText";
import { ResultSummary } from "./ResultSummary";
import { SeasonEditor } from "./SeasonEditor";
import { SeasonModeControl } from "./SeasonModeControl";
import { SuggestionsTable, type SuggestionRow } from "./SuggestionsTable";
import { VacationForm } from "./VacationForm";
import { parseISODate, toISODate, todayLocalDate } from "./lib/dates";
import { getRegionalFairOverlaps } from "./lib/ferias";
import { buildHolidayMap } from "./lib/holidays";
import {
  buildVacationPlan,
  suggestBetterStartDates,
  type VacationCountMode,
} from "./lib/planner";
import {
  applySeasonFilterMode,
  type SeasonFilterMode,
} from "./lib/seasonSuggestions";
import {
  buildSeasonWindows,
  getDayBreakdown,
  type CustomSeasonWindowInput,
  type SeasonWindowKind,
} from "./lib/temporadas";

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
  const [seasonEnabled, setSeasonEnabled] = useState<boolean>(true);
  const [removedSeasonKinds, setRemovedSeasonKinds] = useState<
    Set<SeasonWindowKind>
  >(() => new Set());
  const [customSeasonWindows, setCustomSeasonWindows] = useState<
    Map<string, CustomSeasonWindowInput>
  >(() => new Map());
  const [seasonFilterMode, setSeasonFilterMode] =
    useState<SeasonFilterMode>("indiferente");

  const referenceYear = parseISODate(startISO).getFullYear();

  const holidays = useMemo(
    () => buildHolidayMap(referenceYear, removedHolidays, addedHolidays),
    [referenceYear, removedHolidays, addedHolidays],
  );

  const plan = useMemo(() => {
    if (!startISO || days === null) return null;
    return buildVacationPlan(startISO, days, mode, holidays);
  }, [startISO, days, mode, holidays]);

  // Cuando la temporada está desactivada, estas ventanas quedan vacías y
  // ningún cálculo de temporada se ejecuta más abajo: es la misma ruta
  // original de la herramienta antes de que existiera esta funcionalidad.
  const seasonWindows = useMemo(() => {
    if (!seasonEnabled) return [];
    return buildSeasonWindows(referenceYear, removedSeasonKinds, customSeasonWindows);
  }, [seasonEnabled, referenceYear, removedSeasonKinds, customSeasonWindows]);

  const seasonBreakdown = useMemo(() => {
    if (!seasonEnabled || !plan) return null;
    return getDayBreakdown(plan.start, plan.last, seasonWindows);
  }, [seasonEnabled, plan, seasonWindows]);

  const regionalFairs = useMemo(() => {
    if (!seasonEnabled || !plan) return [];
    return getRegionalFairOverlaps(plan.start, plan.last);
  }, [seasonEnabled, plan]);

  const suggestionsResult = useMemo(() => {
    if (!plan || days === null) {
      return { visible: [] as SuggestionRow[], hiddenCount: 0, bestHiddenRestDays: null, isEmpty: false };
    }

    if (!seasonEnabled) {
      const picks = suggestBetterStartDates(startISO, days, mode, holidays, plan);
      const visible: SuggestionRow[] = picks
        .filter(
          (candidate) =>
            toISODate(candidate.start) === toISODate(plan.start) ||
            candidate.restDays >= plan.restDays,
        )
        .map((candidatePlan) => ({ plan: candidatePlan, season: null }));
      return { visible, hiddenCount: 0, bestHiddenRestDays: null, isEmpty: false };
    }

    const result = applySeasonFilterMode(
      startISO,
      days,
      mode,
      holidays,
      seasonWindows,
      plan,
      seasonFilterMode,
    );
    const currentISO = toISODate(plan.start);
    const visible: SuggestionRow[] = result.visible
      .filter(
        (row) =>
          toISODate(row.plan.start) === currentISO || row.plan.restDays >= plan.restDays,
      )
      .map((row) => ({ plan: row.plan, season: row.season }));

    return {
      visible,
      hiddenCount: result.hiddenCount,
      bestHiddenRestDays: result.bestHiddenRestDays,
      isEmpty: result.isEmpty,
    };
  }, [plan, days, seasonEnabled, startISO, mode, holidays, seasonWindows, seasonFilterMode]);

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

  const handleRemoveSeasonKind = useCallback((kind: SeasonWindowKind): void => {
    setRemovedSeasonKinds((previous) => new Set(previous).add(kind));
  }, []);

  const handleRemoveCustomSeasonWindow = useCallback((id: string): void => {
    setCustomSeasonWindows((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const handleAddCustomSeasonWindow = useCallback(
    (start: string, end: string, label: string): void => {
      const id = crypto.randomUUID();
      setCustomSeasonWindows((previous) =>
        new Map(previous).set(id, { id, label, start, end }),
      );
    },
    [],
  );

  const handleRevertToIndiferente = useCallback((): void => {
    setSeasonFilterMode("indiferente");
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
        <ResultSummary
          plan={plan}
          holidays={holidays}
          seasonBreakdown={seasonBreakdown}
          regionalFairs={regionalFairs}
        />
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
          <CalendarPlanner plan={plan} holidays={holidays} seasonWindows={seasonWindows} />
        </section>
      )}

      {plan && suggestionsResult.visible.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">
            Mejores fechas para empezar
          </h2>
          {seasonEnabled && (
            <SeasonModeControl mode={seasonFilterMode} onChange={setSeasonFilterMode} />
          )}
          <SuggestionsTable
            plan={plan}
            suggestions={suggestionsResult.visible}
            onSelectStart={setStartISO}
            seasonFilter={
              seasonEnabled
                ? {
                    mode: seasonFilterMode,
                    hiddenCount: suggestionsResult.hiddenCount,
                    bestHiddenRestDays: suggestionsResult.bestHiddenRestDays,
                    isEmpty: suggestionsResult.isEmpty,
                    onRevertToIndiferente: handleRevertToIndiferente,
                  }
                : null
            }
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
          referenceYear={referenceYear}
          plan={plan}
          onRemove={handleRemoveHoliday}
          onAdd={handleAddHoliday}
        />
      </section>

      <section>
        <SeasonEditor
          enabled={seasonEnabled}
          onToggleEnabled={setSeasonEnabled}
          windows={seasonWindows}
          referenceYear={referenceYear}
          onRemoveKind={handleRemoveSeasonKind}
          onAddCustom={handleAddCustomSeasonWindow}
          onRemoveCustom={handleRemoveCustomSeasonWindow}
        />
      </section>

      <footer className="max-w-[70ch] border-t border-black/[.08] pt-4 text-xs text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
        El cálculo asume semana laboral de lunes a viernes. En Colombia las
        vacaciones legales son 15 días hábiles por año trabajado y los
        sábados no se descuentan; si tu contrato dice otra cosa, cambia el
        modo de conteo. Verifica siempre el resultado con recursos humanos
        antes de radicar la solicitud. Esta herramienta no guarda ningún dato:
        todo vive en tu navegador y se pierde al recargar la página.
      </footer>
    </div>
  );
}
