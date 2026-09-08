import { addDays, makeLocalDate, parseISODate } from "./dates";
import { getEasterSunday } from "./holidays";

export type SeasonWindowKind =
  | "fin_de_ano"
  | "semana_santa"
  | "mitad_de_ano"
  | "receso_octubre"
  | "personalizada";

export type SeasonPredominance = "alta" | "baja" | "mixto";

export interface SeasonWindow {
  id: string;
  kind: SeasonWindowKind;
  label: string;
  start: Date;
  end: Date;
}

export interface CustomSeasonWindowInput {
  id: string;
  label: string;
  start: string;
  end: string;
}

export interface SeasonDayBreakdown {
  altaDays: number;
  bajaDays: number;
  totalDays: number;
  matchedWindows: SeasonWindow[];
}

/** Ley Emiliani: el festivo se traslada al lunes siguiente (reimplementado aquí para no depender del mapa de festivos ya resuelto). */
function nextMonday(date: Date): Date {
  const weekday = date.getDay();
  return weekday === 1 ? date : addDays(date, (8 - weekday) % 7);
}

/**
 * Ventanas de temporada alta por defecto para un año: fin/inicio de año,
 * Semana Santa, vacaciones escolares de mitad de año y receso escolar de
 * octubre. Son una aproximación de uso común en el sector turístico
 * colombiano, no una regla oficial fija.
 */
export function getDefaultSeasonWindowsForYear(year: number): SeasonWindow[] {
  const easterSunday = getEasterSunday(year);
  const palmSunday = addDays(easterSunday, -7);
  const octoberRecessMonday = nextMonday(makeLocalDate(year, 9, 12));

  return [
    {
      id: `fin_de_ano-${year}`,
      kind: "fin_de_ano",
      label: "Fin y comienzo de año",
      start: makeLocalDate(year, 11, 15),
      end: makeLocalDate(year + 1, 0, 15),
    },
    {
      id: `semana_santa-${year}`,
      kind: "semana_santa",
      label: "Semana Santa",
      start: addDays(palmSunday, -1),
      end: easterSunday,
    },
    {
      id: `mitad_de_ano-${year}`,
      kind: "mitad_de_ano",
      label: "Vacaciones de mitad de año",
      start: makeLocalDate(year, 5, 15),
      end: makeLocalDate(year, 6, 15),
    },
    {
      id: `receso_octubre-${year}`,
      kind: "receso_octubre",
      label: "Receso escolar de octubre",
      start: octoberRecessMonday,
      end: addDays(octoberRecessMonday, 6),
    },
  ];
}

/**
 * Ventanas vigentes para el rango de años relevante, quitando los tipos
 * excluidos por el usuario y agregando los periodos personalizados.
 */
export function buildSeasonWindows(
  referenceYear: number,
  removedKinds: ReadonlySet<SeasonWindowKind>,
  customWindows: ReadonlyMap<string, CustomSeasonWindowInput>,
): SeasonWindow[] {
  const windows: SeasonWindow[] = [];
  for (let year = referenceYear - 1; year <= referenceYear + 1; year += 1) {
    for (const window of getDefaultSeasonWindowsForYear(year)) {
      if (!removedKinds.has(window.kind)) windows.push(window);
    }
  }
  for (const custom of customWindows.values()) {
    windows.push({
      id: custom.id,
      kind: "personalizada",
      label: custom.label,
      start: parseISODate(custom.start),
      end: parseISODate(custom.end),
    });
  }
  return windows;
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function isDateInWindow(date: Date, window: SeasonWindow): boolean {
  return date >= window.start && date <= window.end;
}

/** Desglosa día a día un rango (pensado para rangos cortos, como un periodo de vacaciones). */
export function getDayBreakdown(
  rangeStart: Date,
  rangeEnd: Date,
  windows: readonly SeasonWindow[],
): SeasonDayBreakdown {
  let altaDays = 0;
  let bajaDays = 0;
  const matchedWindows: SeasonWindow[] = [];

  for (
    let current = new Date(rangeStart);
    current <= rangeEnd;
    current = addDays(current, 1)
  ) {
    const dayWindows = windows.filter((window) => isDateInWindow(current, window));
    if (dayWindows.length > 0) {
      altaDays += 1;
      for (const window of dayWindows) {
        if (!matchedWindows.some((w) => w.id === window.id)) matchedWindows.push(window);
      }
    } else {
      bajaDays += 1;
    }
  }

  return {
    altaDays,
    bajaDays,
    totalDays: altaDays + bajaDays,
    matchedWindows,
  };
}

export function getPredominantSeason(
  breakdown: SeasonDayBreakdown,
): SeasonPredominance {
  if (breakdown.altaDays === breakdown.bajaDays) return "mixto";
  return breakdown.altaDays > breakdown.bajaDays ? "alta" : "baja";
}

/** ¿Esta semana (representada por su lunes) solapa alguna ventana de temporada alta? */
export function weekOverlapsHighSeason(
  weekMonday: Date,
  windows: readonly SeasonWindow[],
): boolean {
  const weekSunday = addDays(weekMonday, 6);
  return windows.some((window) =>
    rangesOverlap(weekMonday, weekSunday, window.start, window.end),
  );
}
