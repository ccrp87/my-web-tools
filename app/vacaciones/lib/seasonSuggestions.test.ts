import { describe, expect, it } from "vitest";
import { makeLocalDate, toISODate } from "./dates";
import { buildVacationPlan, suggestBetterStartDates } from "./planner";
import { applySeasonFilterMode } from "./seasonSuggestions";
import type { SeasonWindow } from "./temporadas";

const NO_HOLIDAYS = new Map<string, string>();
const BASE = "2026-02-02"; // lunes, sin festivos cercanos en Colombia
const DAYS = 5;

// Ventana sintética que coincide exactamente con el periodo de la candidata
// que empieza el lunes 2026-03-02 (lunes a viernes esa misma semana).
const ALTA_WINDOW: SeasonWindow = {
  id: "test-alta",
  kind: "personalizada",
  label: "Ventana de prueba",
  start: makeLocalDate(2026, 2, 2),
  end: makeLocalDate(2026, 2, 6),
};

describe("applySeasonFilterMode · indiferente", () => {
  it("delega tal cual en suggestBetterStartDates, sin agrupar", () => {
    const current = buildVacationPlan(BASE, DAYS, "habiles", NO_HOLIDAYS);
    const expected = suggestBetterStartDates(BASE, DAYS, "habiles", NO_HOLIDAYS, current);
    const result = applySeasonFilterMode(
      BASE,
      DAYS,
      "habiles",
      NO_HOLIDAYS,
      [ALTA_WINDOW],
      current,
      "indiferente",
    );
    expect(result.visible.map((r) => toISODate(r.plan.start))).toEqual(
      expected.map((p) => toISODate(p.start)),
    );
    expect(result.hiddenCount).toBe(0);
    expect(result.bestHiddenRestDays).toBeNull();
  });
});

describe("applySeasonFilterMode · excluir_alta", () => {
  it("saca del listado la fecha cuyo periodo cae en temporada alta", () => {
    const current = buildVacationPlan(BASE, DAYS, "habiles", NO_HOLIDAYS);
    const result = applySeasonFilterMode(
      BASE,
      DAYS,
      "habiles",
      NO_HOLIDAYS,
      [ALTA_WINDOW],
      current,
      "excluir_alta",
    );
    expect(
      result.visible.some((r) => toISODate(r.plan.start) === "2026-03-02"),
    ).toBe(false);
    expect(result.hiddenCount).toBeGreaterThan(0);
    expect(result.bestHiddenRestDays).not.toBeNull();
  });

  it("sigue mostrando la fecha elegida por el usuario aunque caiga en temporada alta, y no la cuenta como oculta", () => {
    const currentInAlta = buildVacationPlan("2026-03-02", DAYS, "habiles", NO_HOLIDAYS);
    const resultWithCurrent = applySeasonFilterMode(
      BASE,
      DAYS,
      "habiles",
      NO_HOLIDAYS,
      [ALTA_WINDOW],
      currentInAlta,
      "excluir_alta",
    );
    const resultWithoutCurrent = applySeasonFilterMode(
      BASE,
      DAYS,
      "habiles",
      NO_HOLIDAYS,
      [ALTA_WINDOW],
      null,
      "excluir_alta",
    );

    expect(
      resultWithCurrent.visible.some((r) => toISODate(r.plan.start) === "2026-03-02"),
    ).toBe(true);
    // La propia fecha del usuario no debe sumar al conteo de ocultas: el
    // total debe ser exactamente una menos que sin ninguna fecha actual.
    expect(resultWithCurrent.hiddenCount).toBe(resultWithoutCurrent.hiddenCount - 1);
  });

  it("declara isEmpty cuando no queda ninguna sugerencia real fuera de temporada alta", () => {
    const hugeAltaWindow: SeasonWindow = {
      id: "test-alta-huge",
      kind: "personalizada",
      label: "Todo el horizonte",
      start: makeLocalDate(2026, 1, 1),
      end: makeLocalDate(2026, 11, 31),
    };
    const current = buildVacationPlan(BASE, DAYS, "habiles", NO_HOLIDAYS);
    const result = applySeasonFilterMode(
      BASE,
      DAYS,
      "habiles",
      NO_HOLIDAYS,
      [hugeAltaWindow],
      current,
      "excluir_alta",
    );
    expect(result.isEmpty).toBe(true);
    // La fecha del usuario se sigue mostrando como referencia.
    expect(result.visible).toHaveLength(1);
    expect(toISODate(result.visible[0].plan.start)).toBe(BASE);
  });
});

describe("applySeasonFilterMode · preferir_alta", () => {
  it("ordena primero las fechas cuyo periodo cae en temporada alta", () => {
    const current = buildVacationPlan(BASE, DAYS, "habiles", NO_HOLIDAYS);
    const result = applySeasonFilterMode(
      BASE,
      DAYS,
      "habiles",
      NO_HOLIDAYS,
      [ALTA_WINDOW],
      current,
      "preferir_alta",
    );
    expect(result.visible[0].season).toBe("alta");
    expect(toISODate(result.visible[0].plan.start)).toBe("2026-03-02");
  });

  it("no oculta ninguna fecha (hiddenCount siempre 0)", () => {
    const current = buildVacationPlan(BASE, DAYS, "habiles", NO_HOLIDAYS);
    const result = applySeasonFilterMode(
      BASE,
      DAYS,
      "habiles",
      NO_HOLIDAYS,
      [ALTA_WINDOW],
      current,
      "preferir_alta",
    );
    expect(result.hiddenCount).toBe(0);
    expect(result.bestHiddenRestDays).toBeNull();
  });
});
