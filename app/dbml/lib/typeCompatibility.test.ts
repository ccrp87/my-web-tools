import { describe, expect, it } from "vitest";
import { areColumnTypesCompatible, getColumnTypeCategory } from "./typeCompatibility";

describe("getColumnTypeCategory", () => {
  it("agrupa variantes enteras de distintos dialectos en la misma categoría", () => {
    expect(getColumnTypeCategory("INT")).toBe(getColumnTypeCategory("integer"));
    expect(getColumnTypeCategory("BIGINT")).toBe(getColumnTypeCategory("serial"));
    expect(getColumnTypeCategory("INT UNSIGNED")).toBe(getColumnTypeCategory("INTEGER"));
  });

  it("ignora los argumentos entre paréntesis", () => {
    expect(getColumnTypeCategory("VARCHAR(255)")).toBe(getColumnTypeCategory("varchar"));
    expect(getColumnTypeCategory("DECIMAL(10,2)")).toBe(getColumnTypeCategory("numeric"));
  });

  it("trata un tipo desconocido (p. ej. un enum) como su propio nombre normalizado", () => {
    expect(getColumnTypeCategory("user_role")).toBe("user_role");
    expect(getColumnTypeCategory("USER_ROLE")).toBe("user_role");
  });
});

describe("areColumnTypesCompatible", () => {
  it("considera compatibles tipos enteros equivalentes entre dialectos", () => {
    expect(areColumnTypesCompatible("INT", "integer")).toBe(true);
    expect(areColumnTypesCompatible("BIGINT", "SERIAL")).toBe(true);
  });

  it("no considera compatibles categorías distintas", () => {
    expect(areColumnTypesCompatible("integer", "varchar")).toBe(false);
    expect(areColumnTypesCompatible("timestamp", "integer")).toBe(false);
  });

  it("dos enums distintos no son compatibles entre sí", () => {
    expect(areColumnTypesCompatible("user_role", "post_status")).toBe(false);
  });

  it("el mismo enum es compatible consigo mismo", () => {
    expect(areColumnTypesCompatible("user_role", "user_role")).toBe(true);
  });
});
