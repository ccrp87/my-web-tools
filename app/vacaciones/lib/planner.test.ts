import { describe, expect, it } from "vitest";
import { toISODate } from "./dates";
import {
  buildVacationPlan,
  isWorkday,
  suggestBetterStartDates,
} from "./planner";

// Febrero de 2026 no tiene festivos colombianos, así que sirve como
// escenario "limpio" para verificar el conteo de días hábiles/calendario.
const NO_HOLIDAYS = new Map<string, string>();

describe("isWorkday", () => {
  it("considera hábiles los días de lunes a viernes sin festivo", () => {
    expect(isWorkday(new Date(2026, 1, 2, 12), NO_HOLIDAYS)).toBe(true); // lunes
    expect(isWorkday(new Date(2026, 1, 6, 12), NO_HOLIDAYS)).toBe(true); // viernes
  });

  it("considera no hábiles sábados y domingos", () => {
    expect(isWorkday(new Date(2026, 1, 7, 12), NO_HOLIDAYS)).toBe(false); // sábado
    expect(isWorkday(new Date(2026, 1, 8, 12), NO_HOLIDAYS)).toBe(false); // domingo
  });

  it("considera no hábil un día marcado como festivo", () => {
    const holidays = new Map([["2026-02-04", "Prueba"]]);
    expect(isWorkday(new Date(2026, 1, 4, 12), holidays)).toBe(false);
  });
});

describe("buildVacationPlan · modo días hábiles", () => {
  it("cuenta 5 días hábiles seguidos sin festivos como una semana completa", () => {
    const plan = buildVacationPlan("2026-02-02", 5, "habiles", NO_HOLIDAYS);
    expect(plan).not.toBeNull();
    expect(toISODate(plan!.last)).toBe("2026-02-06"); // viernes
    expect(plan!.spent).toBe(5);
    expect(plan!.calendarDays).toBe(5);
    expect(toISODate(plan!.back)).toBe("2026-02-09"); // lunes siguiente
    expect(toISODate(plan!.restStart)).toBe("2026-01-31"); // sábado anterior
    expect(toISODate(plan!.restEnd)).toBe("2026-02-08"); // domingo posterior
    expect(plan!.restDays).toBe(9);
    expect(plan!.hits).toHaveLength(0);
    expect(plan!.startsOnNonWorkday).toBe(false);
  });

  it("salta un festivo dentro del rango y lo reporta en 'hits'", () => {
    const holidays = new Map([["2026-02-04", "Puente de prueba"]]);
    const plan = buildVacationPlan("2026-02-02", 5, "habiles", holidays);
    expect(plan).not.toBeNull();
    expect(toISODate(plan!.last)).toBe("2026-02-09"); // el festivo corre el último día
    expect(plan!.spent).toBe(5);
    expect(plan!.hits).toEqual([
      { iso: "2026-02-04", name: "Puente de prueba", date: expect.any(Date) },
    ]);
    expect(toISODate(plan!.back)).toBe("2026-02-10");
  });

  it("no descuenta nada si el primer día ya es fin de semana", () => {
    const plan = buildVacationPlan("2026-02-07", 3, "habiles", NO_HOLIDAYS); // sábado
    expect(plan).not.toBeNull();
    expect(plan!.startsOnNonWorkday).toBe(true);
  });

  it("devuelve null si el número de días es tan grande que excede el límite de búsqueda", () => {
    const plan = buildVacationPlan("2026-02-02", 100_000, "habiles", NO_HOLIDAYS);
    expect(plan).toBeNull();
  });
});

describe("buildVacationPlan · modo días calendario", () => {
  it("cuenta días corridos incluyendo el fin de semana en el total, no en lo descontado", () => {
    const plan = buildVacationPlan("2026-02-02", 10, "calendario", NO_HOLIDAYS);
    expect(plan).not.toBeNull();
    expect(toISODate(plan!.last)).toBe("2026-02-11");
    expect(plan!.calendarDays).toBe(10);
    expect(plan!.spent).toBe(8); // 10 días corridos menos el sábado y domingo intermedios
    expect(toISODate(plan!.back)).toBe("2026-02-12");
    expect(plan!.restDays).toBe(12);
  });
});

describe("suggestBetterStartDates", () => {
  it("siempre incluye la fecha actual del usuario, aunque no sea óptima", () => {
    const current = buildVacationPlan("2026-02-02", 5, "habiles", NO_HOLIDAYS);
    const picks = suggestBetterStartDates(
      "2026-02-02",
      5,
      "habiles",
      NO_HOLIDAYS,
      current,
    );
    expect(picks.some((p) => toISODate(p.start) === "2026-02-02")).toBe(true);
  });

  it("devuelve como máximo 6 sugerencias ordenadas por fecha de inicio", () => {
    const current = buildVacationPlan("2026-02-02", 5, "habiles", NO_HOLIDAYS);
    const picks = suggestBetterStartDates(
      "2026-02-02",
      5,
      "habiles",
      NO_HOLIDAYS,
      current,
    );
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.length).toBeLessThanOrEqual(6);
    const starts = picks.map((p) => p.start.getTime());
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
  });

  it("prioriza una fecha que aprovecha un festivo pegado al fin de semana", () => {
    // Festivo el lunes 2026-03-09: empezar el martes 10 (justo después del
    // festivo largo) rinde más descanso por día gastado que la fecha
    // elegida originalmente (martes 3 de marzo, sin festivo pegado).
    const holidays = new Map([["2026-03-09", "Festivo de prueba"]]);
    const current = buildVacationPlan("2026-03-03", 4, "habiles", holidays);
    const picks = suggestBetterStartDates(
      "2026-03-03",
      4,
      "habiles",
      holidays,
      current,
    );

    const currentPick = picks.find(
      (p) => toISODate(p.start) === "2026-03-03",
    )!;
    const bestPick = picks.reduce((a, b) => (b.score > a.score ? b : a));

    expect(toISODate(bestPick.start)).toBe("2026-03-10");
    expect(bestPick.score).toBeGreaterThan(currentPick.score);
  });
});
