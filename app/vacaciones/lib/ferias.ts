import { addDays, makeLocalDate } from "./dates";
import { getEasterSunday } from "./holidays";

export interface RegionalFair {
  name: string;
  city: string;
  start: Date;
  end: Date;
  /** Si es false, la fecha es exacta (calculada o fija); si es true, es una referencia aproximada que fijan los organizadores cada año. */
  approximate: boolean;
}

/**
 * Ferias regionales de Colombia, puramente informativas: afectan precios y
 * ocupación solo en su ciudad, no clasifican como temporada alta/baja
 * nacional. Solo el Carnaval de Barranquilla (calculado desde la Pascua) y
 * las de fecha fija son exactas; las demás son aproximadas.
 */
export function getRegionalFairsForYear(year: number): RegionalFair[] {
  const ashWednesday = addDays(getEasterSunday(year), -46);

  return [
    {
      name: "Carnaval de Negros y Blancos",
      city: "Pasto",
      start: makeLocalDate(year, 0, 2),
      end: makeLocalDate(year, 0, 7),
      approximate: false,
    },
    {
      name: "Feria de Manizales",
      city: "Manizales",
      start: makeLocalDate(year, 0, 1),
      end: makeLocalDate(year, 0, 7),
      approximate: true,
    },
    {
      name: "Carnaval de Barranquilla",
      city: "Barranquilla",
      start: addDays(ashWednesday, -4),
      end: addDays(ashWednesday, -1),
      approximate: false,
    },
    {
      name: "Festival Vallenato",
      city: "Valledupar",
      start: makeLocalDate(year, 3, 22),
      end: makeLocalDate(year, 3, 30),
      approximate: true,
    },
    {
      name: "Feria de las Flores",
      city: "Medellín",
      start: makeLocalDate(year, 7, 1),
      end: makeLocalDate(year, 7, 7),
      approximate: true,
    },
    {
      name: "Feria de Cali",
      city: "Cali",
      start: makeLocalDate(year, 11, 25),
      end: makeLocalDate(year, 11, 30),
      approximate: false,
    },
  ];
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Ferias que solapan el rango dado, considerando el año de cada extremo del rango. */
export function getRegionalFairOverlaps(
  rangeStart: Date,
  rangeEnd: Date,
): RegionalFair[] {
  const years = new Set([rangeStart.getFullYear(), rangeEnd.getFullYear()]);
  const fairs = [...years].flatMap((year) => getRegionalFairsForYear(year));
  return fairs.filter((fair) =>
    rangesOverlap(rangeStart, rangeEnd, fair.start, fair.end),
  );
}
