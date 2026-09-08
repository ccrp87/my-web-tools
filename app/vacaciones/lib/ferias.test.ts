import { describe, expect, it } from "vitest";
import { makeLocalDate, toISODate } from "./dates";
import { getRegionalFairOverlaps, getRegionalFairsForYear } from "./ferias";

describe("getRegionalFairsForYear", () => {
  const fairs2026 = getRegionalFairsForYear(2026);

  it("devuelve las 6 ferias regionales", () => {
    expect(fairs2026).toHaveLength(6);
  });

  it("ubica el Carnaval de Negros y Blancos del 2 al 7 de enero (fecha fija)", () => {
    const fair = fairs2026.find((f) => f.name === "Carnaval de Negros y Blancos")!;
    expect(toISODate(fair.start)).toBe("2026-01-02");
    expect(toISODate(fair.end)).toBe("2026-01-07");
    expect(fair.approximate).toBe(false);
  });

  it("ubica la Feria de Cali del 25 al 30 de diciembre (fecha fija)", () => {
    const fair = fairs2026.find((f) => f.name === "Feria de Cali")!;
    expect(toISODate(fair.start)).toBe("2026-12-25");
    expect(toISODate(fair.end)).toBe("2026-12-30");
    expect(fair.approximate).toBe(false);
  });

  it("calcula el Carnaval de Barranquilla desde el miércoles de ceniza (exacto)", () => {
    const fair = fairs2026.find((f) => f.name === "Carnaval de Barranquilla")!;
    expect(toISODate(fair.start)).toBe("2026-02-14");
    expect(toISODate(fair.end)).toBe("2026-02-17");
    expect(fair.approximate).toBe(false);
  });

  it("recalcula el Carnaval de Barranquilla para otro año (2027)", () => {
    const fairs2027 = getRegionalFairsForYear(2027);
    const fair = fairs2027.find((f) => f.name === "Carnaval de Barranquilla")!;
    expect(toISODate(fair.start)).toBe("2027-02-06");
    expect(toISODate(fair.end)).toBe("2027-02-09");
  });

  it("marca como aproximadas las ferias sin fecha exacta publicada", () => {
    const approximateNames = fairs2026
      .filter((f) => f.approximate)
      .map((f) => f.name);
    expect(approximateNames).toEqual(
      expect.arrayContaining(["Feria de Manizales", "Festival Vallenato", "Feria de las Flores"]),
    );
  });
});

describe("getRegionalFairOverlaps", () => {
  it("encuentra la feria que solapa un rango dado", () => {
    const overlaps = getRegionalFairOverlaps(
      makeLocalDate(2026, 0, 3),
      makeLocalDate(2026, 0, 5),
    );
    expect(overlaps.some((f) => f.name === "Carnaval de Negros y Blancos")).toBe(true);
  });

  it("no encuentra nada en un rango sin ferias", () => {
    const overlaps = getRegionalFairOverlaps(
      makeLocalDate(2026, 8, 1),
      makeLocalDate(2026, 8, 10),
    );
    expect(overlaps).toHaveLength(0);
  });

  it("lista varias ferias si el rango coincide con más de una", () => {
    const overlaps = getRegionalFairOverlaps(
      makeLocalDate(2026, 0, 1),
      makeLocalDate(2026, 0, 7),
    );
    const names = overlaps.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining(["Carnaval de Negros y Blancos", "Feria de Manizales"]),
    );
  });
});
