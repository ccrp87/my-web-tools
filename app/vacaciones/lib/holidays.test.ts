import { describe, expect, it } from "vitest";
import { buildHolidayMap, getColombianHolidays } from "./holidays";

describe("getColombianHolidays", () => {
  it("calcula correctamente los festivos fijos de 2026", () => {
    const holidays = new Map(
      getColombianHolidays(2026).map((h) => [h.name, h.iso]),
    );
    expect(holidays.get("Año Nuevo")).toBe("2026-01-01");
    expect(holidays.get("Día del Trabajo")).toBe("2026-05-01");
    expect(holidays.get("Grito de Independencia")).toBe("2026-07-20");
    expect(holidays.get("Batalla de Boyacá")).toBe("2026-08-07");
    expect(holidays.get("Inmaculada Concepción")).toBe("2026-12-08");
    expect(holidays.get("Navidad")).toBe("2026-12-25");
  });

  it("traslada los festivos móviles (ley Emiliani) al lunes siguiente en 2026", () => {
    const holidays = new Map(
      getColombianHolidays(2026).map((h) => [h.name, h.iso]),
    );
    expect(holidays.get("Reyes Magos")).toBe("2026-01-12");
    expect(holidays.get("San José")).toBe("2026-03-23");
    expect(holidays.get("Ascensión del Señor")).toBe("2026-05-18");
    expect(holidays.get("Corpus Christi")).toBe("2026-06-08");
    expect(holidays.get("Sagrado Corazón")).toBe("2026-06-15");
  });

  it("calcula la Semana Santa a partir de la Pascua de 2026", () => {
    const holidays = new Map(
      getColombianHolidays(2026).map((h) => [h.name, h.iso]),
    );
    expect(holidays.get("Jueves Santo")).toBe("2026-04-02");
    expect(holidays.get("Viernes Santo")).toBe("2026-04-03");
  });

  it("recalcula correctamente los festivos móviles para otro año (2027)", () => {
    const holidays = new Map(
      getColombianHolidays(2027).map((h) => [h.name, h.iso]),
    );
    expect(holidays.get("Reyes Magos")).toBe("2027-01-11");
    expect(holidays.get("Jueves Santo")).toBe("2027-03-25");
    expect(holidays.get("Viernes Santo")).toBe("2027-03-26");
  });

  it("devuelve 18 festivos por año", () => {
    expect(getColombianHolidays(2026)).toHaveLength(18);
  });
});

describe("buildHolidayMap", () => {
  it("incluye festivos del año anterior y de los dos siguientes", () => {
    const map = buildHolidayMap(2026, new Set(), new Map());
    expect(map.has("2025-01-01")).toBe(true);
    expect(map.has("2026-01-01")).toBe(true);
    expect(map.has("2028-01-01")).toBe(true);
    expect(map.has("2029-01-01")).toBe(false);
  });

  it("respeta los festivos eliminados manualmente", () => {
    const map = buildHolidayMap(2026, new Set(["2026-01-01"]), new Map());
    expect(map.has("2026-01-01")).toBe(false);
  });

  it("agrega festivos personalizados y estos tienen prioridad sobre eliminados", () => {
    const map = buildHolidayMap(
      2026,
      new Set(),
      new Map([["2026-12-31", "Cierre de fin de año"]]),
    );
    expect(map.get("2026-12-31")).toBe("Cierre de fin de año");
  });
});
