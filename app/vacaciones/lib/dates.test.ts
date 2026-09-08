import { describe, expect, it } from "vitest";
import { addDays, diffInDays, makeLocalDate, parseISODate, toISODate } from "./dates";

describe("makeLocalDate / toISODate", () => {
  it("crea y formatea una fecha ida y vuelta sin desplazamientos", () => {
    const date = makeLocalDate(2026, 0, 15);
    expect(toISODate(date)).toBe("2026-01-15");
  });

  it("rellena con ceros mes y día de un solo dígito", () => {
    const date = makeLocalDate(2026, 2, 5);
    expect(toISODate(date)).toBe("2026-03-05");
  });
});

describe("parseISODate", () => {
  it("interpreta el ISO como fecha local, no UTC", () => {
    const date = parseISODate("2026-12-25");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(25);
  });
});

describe("addDays", () => {
  it("suma días cruzando el fin de mes", () => {
    const date = makeLocalDate(2026, 0, 30);
    expect(toISODate(addDays(date, 3))).toBe("2026-02-02");
  });

  it("resta días con valores negativos", () => {
    const date = makeLocalDate(2026, 2, 1);
    expect(toISODate(addDays(date, -1))).toBe("2026-02-28");
  });

  it("no muta la fecha original", () => {
    const date = makeLocalDate(2026, 0, 1);
    addDays(date, 5);
    expect(toISODate(date)).toBe("2026-01-01");
  });
});

describe("diffInDays", () => {
  it("cuenta la diferencia entre dos fechas", () => {
    const start = makeLocalDate(2026, 0, 1);
    const end = makeLocalDate(2026, 0, 11);
    expect(diffInDays(start, end)).toBe(10);
  });

  it("es negativa cuando la fecha final es anterior", () => {
    const start = makeLocalDate(2026, 0, 11);
    const end = makeLocalDate(2026, 0, 1);
    expect(diffInDays(start, end)).toBe(-10);
  });
});
