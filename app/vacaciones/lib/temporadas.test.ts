import { describe, expect, it } from "vitest";
import { makeLocalDate, toISODate } from "./dates";
import {
  buildSeasonWindows,
  getDayBreakdown,
  getDefaultSeasonWindowsForYear,
  getPredominantSeason,
  weekOverlapsHighSeason,
} from "./temporadas";

describe("getDefaultSeasonWindowsForYear", () => {
  const windows = getDefaultSeasonWindowsForYear(2026);

  it("ubica Semana Santa del sábado previo a Ramos hasta el domingo de Resurrección", () => {
    const semanaSanta = windows.find((w) => w.kind === "semana_santa")!;
    expect(toISODate(semanaSanta.start)).toBe("2026-03-28");
    expect(toISODate(semanaSanta.end)).toBe("2026-04-05");
  });

  it("ubica el fin de año entre el 15 de diciembre y el 15 de enero siguiente", () => {
    const finDeAno = windows.find((w) => w.kind === "fin_de_ano")!;
    expect(toISODate(finDeAno.start)).toBe("2026-12-15");
    expect(toISODate(finDeAno.end)).toBe("2027-01-15");
  });

  it("ubica la temporada de mitad de año entre el 15 de junio y el 15 de julio", () => {
    const mitadDeAno = windows.find((w) => w.kind === "mitad_de_ano")!;
    expect(toISODate(mitadDeAno.start)).toBe("2026-06-15");
    expect(toISODate(mitadDeAno.end)).toBe("2026-07-15");
  });

  it("ubica el receso escolar de octubre en la semana del lunes trasladado", () => {
    // El 12 de octubre de 2026 ya cae en lunes, así que no se traslada.
    const receso = windows.find((w) => w.kind === "receso_octubre")!;
    expect(toISODate(receso.start)).toBe("2026-10-12");
    expect(toISODate(receso.end)).toBe("2026-10-18");
  });

  it("traslada el receso de octubre al lunes siguiente cuando el 12 no cae en lunes (2027)", () => {
    const windows2027 = getDefaultSeasonWindowsForYear(2027);
    const receso = windows2027.find((w) => w.kind === "receso_octubre")!;
    expect(toISODate(receso.start)).toBe("2027-10-18");
    expect(toISODate(receso.end)).toBe("2027-10-24");
  });
});

describe("buildSeasonWindows", () => {
  it("incluye ventanas de años adyacentes para cubrir bordes de año", () => {
    const windows = buildSeasonWindows(2026, new Set(), new Map());
    const finDeAno2025 = windows.find(
      (w) => w.kind === "fin_de_ano" && toISODate(w.start) === "2025-12-15",
    );
    expect(finDeAno2025).toBeDefined();
  });

  it("excluye los tipos removidos por el usuario", () => {
    const windows = buildSeasonWindows(
      2026,
      new Set(["semana_santa"]),
      new Map(),
    );
    expect(windows.some((w) => w.kind === "semana_santa")).toBe(false);
  });

  it("incluye periodos personalizados agregados por el usuario", () => {
    const windows = buildSeasonWindows(
      2026,
      new Set(),
      new Map([
        ["custom-1", { id: "custom-1", label: "Cierre anual", start: "2026-08-01", end: "2026-08-10" }],
      ]),
    );
    const custom = windows.find((w) => w.id === "custom-1")!;
    expect(custom.kind).toBe("personalizada");
    expect(toISODate(custom.start)).toBe("2026-08-01");
    expect(toISODate(custom.end)).toBe("2026-08-10");
  });
});

describe("getDayBreakdown / getPredominantSeason", () => {
  const windows = getDefaultSeasonWindowsForYear(2026);

  it("clasifica un rango completamente dentro de Semana Santa como todo alta", () => {
    const breakdown = getDayBreakdown(
      makeLocalDate(2026, 2, 30),
      makeLocalDate(2026, 3, 2),
      windows,
    );
    expect(breakdown.altaDays).toBe(4);
    expect(breakdown.bajaDays).toBe(0);
    expect(getPredominantSeason(breakdown)).toBe("alta");
  });

  it("clasifica un rango fuera de cualquier ventana como todo baja", () => {
    const breakdown = getDayBreakdown(
      makeLocalDate(2026, 1, 2),
      makeLocalDate(2026, 1, 10),
      windows,
    );
    expect(breakdown.altaDays).toBe(0);
    expect(getPredominantSeason(breakdown)).toBe("baja");
  });

  it("declara 'mixto' cuando el reparto es exactamente por mitades", () => {
    // 2026-03-27 (baja) y 2026-03-28 (alta, sábado previo a Ramos): 1 y 1.
    const breakdown = getDayBreakdown(
      makeLocalDate(2026, 2, 27),
      makeLocalDate(2026, 2, 28),
      windows,
    );
    expect(breakdown.altaDays).toBe(1);
    expect(breakdown.bajaDays).toBe(1);
    expect(getPredominantSeason(breakdown)).toBe("mixto");
  });

  it("no depende de festivos editados por el usuario, solo de las ventanas dadas", () => {
    // Aunque se le pase un rango que coincide con un festivo cualquiera,
    // la clasificación solo mira las ventanas de temporada.
    const breakdown = getDayBreakdown(
      makeLocalDate(2026, 6, 20), // Grito de Independencia, no es temporada alta
      makeLocalDate(2026, 6, 20),
      windows,
    );
    expect(getPredominantSeason(breakdown)).toBe("baja");
  });
});

describe("weekOverlapsHighSeason", () => {
  const windows = getDefaultSeasonWindowsForYear(2026);

  it("marca la semana que contiene Semana Santa 2026", () => {
    const monday = makeLocalDate(2026, 2, 30); // lunes 30 de marzo
    expect(weekOverlapsHighSeason(monday, windows)).toBe(true);
  });

  it("no marca una semana cualquiera de temporada baja", () => {
    const monday = makeLocalDate(2026, 1, 2); // lunes 2 de febrero
    expect(weekOverlapsHighSeason(monday, windows)).toBe(false);
  });
});
