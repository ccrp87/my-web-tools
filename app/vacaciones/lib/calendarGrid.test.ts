import { describe, expect, it } from "vitest";
import { buildMonthDayCells, getWeekdayLabels, shiftMonth } from "./calendarGrid";
import { makeLocalDate, toISODate } from "./dates";

describe("getWeekdayLabels", () => {
  it("empieza la semana en lunes, como en Colombia", () => {
    expect(getWeekdayLabels()).toEqual(["L", "M", "M", "J", "V", "S", "D"]);
  });
});

describe("shiftMonth", () => {
  it("avanza al mes siguiente cruzando el fin de año", () => {
    const december = makeLocalDate(2026, 11, 1);
    expect(toISODate(shiftMonth(december, 1))).toBe("2027-01-01");
  });

  it("retrocede al mes anterior cruzando el inicio de año", () => {
    const january = makeLocalDate(2026, 0, 1);
    expect(toISODate(shiftMonth(january, -1))).toBe("2025-12-01");
  });
});

describe("buildMonthDayCells", () => {
  it("alinea el primer día del mes bajo su columna de lunes a domingo", () => {
    // Febrero de 2026 empieza en domingo (6 celdas en blanco antes del día 1).
    const cells = buildMonthDayCells(
      makeLocalDate(2026, 1, 1),
      new Map(),
      null,
      "2026-01-01",
    );
    const leadingBlanks = cells.filter((c) => c.day === null).length;
    expect(leadingBlanks).toBe(6);
    expect(cells[6]).toMatchObject({ day: 1, iso: "2026-02-01" });
  });

  it("incluye los 28 días de febrero de 2026", () => {
    const cells = buildMonthDayCells(
      makeLocalDate(2026, 1, 1),
      new Map(),
      null,
      "2026-01-01",
    );
    const days = cells.filter((c) => c.day !== null);
    expect(days).toHaveLength(28);
  });

  it("marca correctamente fines de semana, festivos, seleccionado y hoy", () => {
    const holidays = new Map([["2026-02-04", "Festivo de prueba"]]);
    const cells = buildMonthDayCells(
      makeLocalDate(2026, 1, 1),
      holidays,
      "2026-02-04",
      "2026-02-07",
    );

    const saturday = cells.find((c) => c.iso === "2026-02-07")!;
    expect(saturday.isWeekend).toBe(true);
    expect(saturday.isToday).toBe(true);

    const holiday = cells.find((c) => c.iso === "2026-02-04")!;
    expect(holiday.isHoliday).toBe(true);
    expect(holiday.holidayName).toBe("Festivo de prueba");
    expect(holiday.isSelected).toBe(true);
    expect(holiday.isWeekend).toBe(false);

    const plainDay = cells.find((c) => c.iso === "2026-02-02")!;
    expect(plainDay.isWeekend).toBe(false);
    expect(plainDay.isHoliday).toBe(false);
    expect(plainDay.isSelected).toBe(false);
    expect(plainDay.isToday).toBe(false);
  });
});
