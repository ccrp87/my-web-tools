import { diffInDays } from "./dates";
import {
  rankCandidateStartDates,
  suggestBetterStartDates,
  type VacationCountMode,
  type VacationPlan,
} from "./planner";
import {
  getDayBreakdown,
  getPredominantSeason,
  type SeasonPredominance,
  type SeasonWindow,
} from "./temporadas";

export type SeasonFilterMode = "indiferente" | "excluir_alta" | "preferir_alta";

export interface RankedSuggestion {
  plan: VacationPlan;
  season: SeasonPredominance;
}

export interface SeasonFilteredSuggestions {
  visible: RankedSuggestion[];
  hiddenCount: number;
  bestHiddenRestDays: number | null;
  isEmpty: boolean;
}

const MAX_SUGGESTIONS_PER_GROUP = 5;
const MIN_DAYS_BETWEEN_SUGGESTIONS = 6;

function predominantSeasonOf(
  plan: VacationPlan,
  windows: readonly SeasonWindow[],
): SeasonPredominance {
  return getPredominantSeason(getDayBreakdown(plan.start, plan.last, windows));
}

export function attachSeason(
  candidates: readonly VacationPlan[],
  windows: readonly SeasonWindow[],
): RankedSuggestion[] {
  return candidates.map((plan) => ({
    plan,
    season: predominantSeasonOf(plan, windows),
  }));
}

function pickSeparatedRanked(
  ranked: readonly RankedSuggestion[],
  maxCount: number,
): RankedSuggestion[] {
  const picks: RankedSuggestion[] = [];
  for (const candidate of ranked) {
    const isFarEnough = picks.every(
      (pick) =>
        Math.abs(diffInDays(pick.plan.start, candidate.plan.start)) >
        MIN_DAYS_BETWEEN_SUGGESTIONS,
    );
    if (isFarEnough) picks.push(candidate);
    if (picks.length === maxCount) break;
  }
  return picks;
}

/**
 * Aplica el control de temporada a las sugerencias. En modo "indiferente"
 * delega tal cual en `suggestBetterStartDates` (la ruta original, sin
 * agrupar). En "excluir"/"preferir" recalcula desde el ranking completo
 * para poder separar en grupos por temporada y aplicar la separación
 * mínima entre fechas dentro de cada grupo, no sobre el conjunto total.
 */
export function applySeasonFilterMode(
  baseISO: string,
  requestedDays: number,
  mode: VacationCountMode,
  holidays: ReadonlyMap<string, string>,
  windows: readonly SeasonWindow[],
  current: VacationPlan | null,
  filterMode: SeasonFilterMode,
): SeasonFilteredSuggestions {
  if (filterMode === "indiferente") {
    const picks = suggestBetterStartDates(
      baseISO,
      requestedDays,
      mode,
      holidays,
      current,
    );
    return {
      visible: attachSeason(picks, windows),
      hiddenCount: 0,
      bestHiddenRestDays: null,
      isEmpty: picks.length === 0,
    };
  }

  const ranked = attachSeason(
    rankCandidateStartDates(baseISO, requestedDays, mode, holidays),
    windows,
  );

  const altaGroup = ranked.filter((r) => r.season === "alta");
  const restoGroup = ranked.filter((r) => r.season !== "alta");
  const currentISO = current ? current.start.getTime() : null;
  const includesCurrent = (list: readonly RankedSuggestion[]): boolean =>
    currentISO !== null && list.some((r) => r.plan.start.getTime() === currentISO);
  const currentEntry: RankedSuggestion | null = current
    ? { plan: current, season: predominantSeasonOf(current, windows) }
    : null;

  let visible: RankedSuggestion[];
  let hidden: RankedSuggestion[];
  let isEmpty: boolean;

  if (filterMode === "excluir_alta") {
    const realSuggestions = pickSeparatedRanked(restoGroup, MAX_SUGGESTIONS_PER_GROUP);
    isEmpty = realSuggestions.length === 0;
    visible = [...realSuggestions];
    // La fecha elegida por el usuario siempre se muestra como referencia,
    // aunque caiga en temporada alta: el control filtra sugerencias, no
    // impide elegir. Por eso no cuenta como "oculta" ni evita el aviso de
    // que no quedan sugerencias reales.
    if (currentEntry && !includesCurrent(visible)) visible.push(currentEntry);
    visible.sort((a, b) => a.plan.start.getTime() - b.plan.start.getTime());
    hidden = altaGroup.filter((r) => r.plan.start.getTime() !== currentISO);
  } else {
    const preferred = pickSeparatedRanked(altaGroup, MAX_SUGGESTIONS_PER_GROUP);
    const rest = pickSeparatedRanked(restoGroup, MAX_SUGGESTIONS_PER_GROUP);
    isEmpty = preferred.length === 0 && rest.length === 0;
    if (currentEntry && currentEntry.season === "alta" && !includesCurrent(preferred)) {
      preferred.push(currentEntry);
    } else if (currentEntry && currentEntry.season !== "alta" && !includesCurrent(rest)) {
      rest.push(currentEntry);
    }
    visible = [...preferred, ...rest];
    hidden = [];
  }

  const bestHiddenRestDays =
    hidden.length > 0
      ? hidden.reduce((best, r) => Math.max(best, r.plan.restDays), 0)
      : null;

  return {
    visible,
    hiddenCount: hidden.length,
    bestHiddenRestDays,
    isEmpty,
  };
}
