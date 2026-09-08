import { formatLongDate, formatShortDate } from "./format";
import type { VacationPlan } from "./planner";

/** Líneas de texto plano listas para copiar en un correo o formulario de RRHH. */
export function buildRequestSummaryLines(plan: VacationPlan): string[] {
  const lines: string[] = [
    "Solicitud de vacaciones",
    "",
    `Inicio: ${formatLongDate(plan.start)}`,
    `Último día de vacaciones: ${formatLongDate(plan.last)}`,
    `Reintegro: ${formatLongDate(plan.back)}`,
    "",
    `Días hábiles solicitados: ${plan.spent}`,
    `Días calendario: ${plan.calendarDays}`,
  ];

  if (plan.hits.length > 0) {
    const holidaysList = plan.hits
      .map((hit) => `${hit.name} (${formatShortDate(hit.date)})`)
      .join(", ");
    lines.push("", `Festivos dentro del periodo: ${holidaysList}`);
  }

  return lines;
}
