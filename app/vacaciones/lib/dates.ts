const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Construye una fecha al mediodía hora local para evitar que cambios de
 * huso horario o DST desplacen el día al comparar o formatear fechas.
 */
export function makeLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12, 0, 0, 0);
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return makeLocalDate(year, month - 1, day);
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function diffInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);
}

export function todayLocalDate(): Date {
  const now = new Date();
  return makeLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
}
