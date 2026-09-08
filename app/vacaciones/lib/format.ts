const longDateFormatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const monthYearFormatter = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
});

export function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatLongDate(date: Date): string {
  return capitalize(longDateFormatter.format(date));
}

export function formatShortDate(date: Date): string {
  return capitalize(shortDateFormatter.format(date));
}

export function formatMonthYear(date: Date): string {
  return capitalize(monthYearFormatter.format(date));
}
