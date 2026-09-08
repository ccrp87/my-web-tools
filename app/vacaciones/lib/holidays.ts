import { addDays, makeLocalDate, toISODate } from "./dates";

export interface Holiday {
  iso: string;
  name: string;
}

/**
 * Calcula el domingo de Pascua para un año dado (algoritmo de
 * Meeus/Jones/Butcher). A partir de esta fecha se derivan los festivos
 * móviles de Semana Santa y Corpus Christi, y la ventana de temporada
 * alta de Semana Santa (ver lib/temporadas.ts).
 */
export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeLocalDate(year, month - 1, day);
}

/** Ley Emiliani: el festivo se traslada al lunes siguiente. */
function nextMonday(date: Date): Date {
  const weekday = date.getDay();
  return weekday === 1 ? date : addDays(date, (8 - weekday) % 7);
}

/** Festivos oficiales de Colombia para un año determinado. */
export function getColombianHolidays(year: number): Holiday[] {
  const easterSunday = getEasterSunday(year);
  const holidayDates: ReadonlyArray<readonly [Date, string]> = [
    [makeLocalDate(year, 0, 1), "Año Nuevo"],
    [makeLocalDate(year, 4, 1), "Día del Trabajo"],
    [makeLocalDate(year, 6, 20), "Grito de Independencia"],
    [makeLocalDate(year, 7, 7), "Batalla de Boyacá"],
    [makeLocalDate(year, 11, 8), "Inmaculada Concepción"],
    [makeLocalDate(year, 11, 25), "Navidad"],
    [nextMonday(makeLocalDate(year, 0, 6)), "Reyes Magos"],
    [nextMonday(makeLocalDate(year, 2, 19)), "San José"],
    [nextMonday(makeLocalDate(year, 5, 29)), "San Pedro y San Pablo"],
    [nextMonday(makeLocalDate(year, 7, 15)), "Asunción de la Virgen"],
    [nextMonday(makeLocalDate(year, 9, 12)), "Día de la Raza"],
    [nextMonday(makeLocalDate(year, 10, 1)), "Todos los Santos"],
    [nextMonday(makeLocalDate(year, 10, 11)), "Independencia de Cartagena"],
    [addDays(easterSunday, -3), "Jueves Santo"],
    [addDays(easterSunday, -2), "Viernes Santo"],
    [nextMonday(addDays(easterSunday, 39)), "Ascensión del Señor"],
    [nextMonday(addDays(easterSunday, 60)), "Corpus Christi"],
    [nextMonday(addDays(easterSunday, 68)), "Sagrado Corazón"],
  ];
  return holidayDates.map(([date, name]) => ({ iso: toISODate(date), name }));
}

/**
 * Construye el mapa de festivos vigente para el rango de años relevante,
 * aplicando las exclusiones e inclusiones manuales del usuario.
 */
export function buildHolidayMap(
  referenceYear: number,
  removedISOs: ReadonlySet<string>,
  addedHolidays: ReadonlyMap<string, string>,
): Map<string, string> {
  const holidayMap = new Map<string, string>();
  for (let year = referenceYear - 1; year <= referenceYear + 2; year += 1) {
    for (const holiday of getColombianHolidays(year)) {
      holidayMap.set(holiday.iso, holiday.name);
    }
  }
  for (const iso of removedISOs) holidayMap.delete(iso);
  for (const [iso, name] of addedHolidays) holidayMap.set(iso, name);
  return holidayMap;
}
