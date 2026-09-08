import { addDays, diffInDays, parseISODate, toISODate } from "./dates";

export type VacationCountMode = "habiles" | "calendario";

export interface HolidayHit {
  iso: string;
  name: string;
  date: Date;
}

export interface VacationPlan {
  start: Date;
  last: Date;
  back: Date;
  spent: number;
  hits: HolidayHit[];
  restStart: Date;
  restEnd: Date;
  calendarDays: number;
  restDays: number;
  startsOnNonWorkday: boolean;
  score: number;
}

/** Límite de búsqueda para evitar bucles infinitos con valores absurdos de días. */
const MAX_SEARCH_DAYS = 3000;
const SUGGESTION_SEARCH_WINDOW_DAYS = 200;
const MAX_SUGGESTIONS = 5;
const MIN_DAYS_BETWEEN_SUGGESTIONS = 6;

export function isWorkday(
  date: Date,
  holidays: ReadonlyMap<string, string>,
): boolean {
  const weekday = date.getDay();
  return weekday !== 0 && weekday !== 6 && !holidays.has(toISODate(date));
}

export function firstWorkdayOnOrAfter(
  date: Date,
  holidays: ReadonlyMap<string, string>,
): Date {
  let cursor = new Date(date);
  while (!isWorkday(cursor, holidays)) cursor = addDays(cursor, 1);
  return cursor;
}

/** Primer día de la racha de descanso continuo que contiene `date`. */
export function startOfRestStreak(
  date: Date,
  holidays: ReadonlyMap<string, string>,
): Date {
  let cursor = new Date(date);
  while (!isWorkday(addDays(cursor, -1), holidays)) cursor = addDays(cursor, -1);
  return cursor;
}

export function buildVacationPlan(
  startISO: string,
  requestedDays: number,
  mode: VacationCountMode,
  holidays: ReadonlyMap<string, string>,
): VacationPlan | null {
  const start = parseISODate(startISO);
  let last: Date;

  if (mode === "habiles") {
    let cursor = new Date(start);
    let counted = 0;
    let guard = 0;
    for (;;) {
      if (isWorkday(cursor, holidays)) {
        counted += 1;
        if (counted === requestedDays) {
          last = cursor;
          break;
        }
      }
      cursor = addDays(cursor, 1);
      guard += 1;
      if (guard > MAX_SEARCH_DAYS) return null;
    }
  } else {
    last = addDays(start, requestedDays - 1);
  }

  let spent = 0;
  const hits: HolidayHit[] = [];
  for (
    let current = new Date(start);
    current <= last;
    current = addDays(current, 1)
  ) {
    if (isWorkday(current, holidays)) spent += 1;
    const iso = toISODate(current);
    const name = holidays.get(iso);
    if (name) hits.push({ iso, name, date: new Date(current) });
  }

  const back = firstWorkdayOnOrAfter(addDays(last, 1), holidays);
  const restStart = startOfRestStreak(start, holidays);
  const restEnd = addDays(back, -1);
  const restDays = diffInDays(restStart, restEnd) + 1;

  return {
    start,
    last,
    back,
    spent,
    hits,
    restStart,
    restEnd,
    calendarDays: diffInDays(start, last) + 1,
    restDays,
    startsOnNonWorkday: !isWorkday(start, holidays),
    score: spent > 0 ? restDays / spent : 0,
  };
}

/**
 * Genera y ordena por conveniencia todas las fechas de inicio candidatas
 * dentro de la ventana de búsqueda, sin recortarlas ni separarlas. Es la
 * base tanto de `suggestBetterStartDates` como de cualquier agrupación
 * adicional (por ejemplo, por temporada) que necesite ver el conjunto
 * completo antes de elegir.
 */
export function rankCandidateStartDates(
  baseISO: string,
  requestedDays: number,
  mode: VacationCountMode,
  holidays: ReadonlyMap<string, string>,
): VacationPlan[] {
  const from = parseISODate(baseISO);
  const candidates: VacationPlan[] = [];

  for (let offset = 0; offset <= SUGGESTION_SEARCH_WINDOW_DAYS; offset += 1) {
    const candidateStart = addDays(from, offset);
    if (!isWorkday(candidateStart, holidays)) continue;
    const candidatePlan = buildVacationPlan(
      toISODate(candidateStart),
      requestedDays,
      mode,
      holidays,
    );
    if (candidatePlan) candidates.push(candidatePlan);
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.restDays - a.restDays ||
      a.spent - b.spent ||
      a.start.getTime() - b.start.getTime(),
  );

  return candidates;
}

/**
 * Elige, en orden, hasta `maxCount` candidatas que estén separadas entre sí
 * por más de `minGapDays` días (para no repetir la misma semana varias veces).
 */
export function pickSeparatedTopCandidates(
  candidates: readonly VacationPlan[],
  maxCount: number,
  minGapDays: number,
): VacationPlan[] {
  const picks: VacationPlan[] = [];
  for (const candidate of candidates) {
    const isFarEnoughFromPicks = picks.every(
      (pick) => Math.abs(diffInDays(pick.start, candidate.start)) > minGapDays,
    );
    if (isFarEnoughFromPicks) picks.push(candidate);
    if (picks.length === maxCount) break;
  }
  return picks;
}

/**
 * Propone fechas de inicio alternativas, dentro de una ventana de búsqueda,
 * que aprovechen mejor los fines de semana y festivos cercanos. Las fechas
 * elegidas se separan entre sí para no repetir la misma semana, y la fecha
 * actual del usuario siempre se incluye para poder compararla.
 */
export function suggestBetterStartDates(
  baseISO: string,
  requestedDays: number,
  mode: VacationCountMode,
  holidays: ReadonlyMap<string, string>,
  current: VacationPlan | null,
): VacationPlan[] {
  const candidates = rankCandidateStartDates(baseISO, requestedDays, mode, holidays);
  const picks = pickSeparatedTopCandidates(
    candidates,
    MAX_SUGGESTIONS,
    MIN_DAYS_BETWEEN_SUGGESTIONS,
  );

  if (
    current &&
    !picks.some((pick) => toISODate(pick.start) === toISODate(current.start))
  ) {
    picks.push(current);
  }

  picks.sort((a, b) => a.start.getTime() - b.start.getTime());
  return picks;
}
