import { describe, expect, it } from "vitest";
import { buildVacationPlan } from "./planner";
import { buildRequestSummaryLines } from "./summary";

describe("buildRequestSummaryLines", () => {
  it("arma el texto base sin festivos dentro del periodo", () => {
    const plan = buildVacationPlan(
      "2026-02-02",
      5,
      "habiles",
      new Map(),
    )!;
    const lines = buildRequestSummaryLines(plan);

    expect(lines[0]).toBe("Solicitud de vacaciones");
    expect(lines.some((l) => l.startsWith("Inicio:"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Reintegro:"))).toBe(true);
    expect(lines.some((l) => l.includes("Días hábiles solicitados: 5"))).toBe(
      true,
    );
    expect(lines.some((l) => l.startsWith("Festivos dentro del periodo"))).toBe(
      false,
    );
  });

  it("agrega la línea de festivos cuando el periodo incluye alguno", () => {
    const holidays = new Map([["2026-02-04", "Puente de prueba"]]);
    const plan = buildVacationPlan("2026-02-02", 5, "habiles", holidays)!;
    const lines = buildRequestSummaryLines(plan);

    const holidayLine = lines.find((l) =>
      l.startsWith("Festivos dentro del periodo"),
    );
    expect(holidayLine).toContain("Puente de prueba");
  });
});
