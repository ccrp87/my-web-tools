import { describe, expect, it } from "vitest";
import { parseColumnSettings, parseTableSettings } from "./columnSettings";

describe("parseColumnSettings", () => {
  it("interpreta pk/primary key", () => {
    expect(parseColumnSettings(["pk"]).isPrimaryKey).toBe(true);
    expect(parseColumnSettings(["primary key"]).isPrimaryKey).toBe(true);
    expect(parseColumnSettings([]).isPrimaryKey).toBe(false);
  });

  it("interpreta not null y null", () => {
    expect(parseColumnSettings(["not null"]).isNotNull).toBe(true);
    expect(parseColumnSettings(["null"]).isNotNull).toBe(false);
  });

  it("interpreta unique e increment", () => {
    const result = parseColumnSettings(["unique", "increment"]);
    expect(result.isUnique).toBe(true);
    expect(result.isIncrement).toBe(true);
  });

  it("interpreta default con comillas", () => {
    expect(parseColumnSettings(["default: 'member'"]).defaultValue).toBe("member");
  });

  it("interpreta default numérico sin comillas", () => {
    expect(parseColumnSettings(["default: 0"]).defaultValue).toBe("0");
  });

  it("interpreta note", () => {
    expect(parseColumnSettings(["note: 'algo importante'"]).note).toBe("algo importante");
  });

  it("interpreta ref inline con los 4 símbolos", () => {
    expect(parseColumnSettings(["ref: > users.id"]).inlineRef).toEqual({
      symbol: ">",
      table: "users",
      column: "id",
    });
    expect(parseColumnSettings(["ref: < users.id"]).inlineRef?.symbol).toBe("<");
    expect(parseColumnSettings(["ref: - users.id"]).inlineRef?.symbol).toBe("-");
    expect(parseColumnSettings(["ref: <> users.id"]).inlineRef?.symbol).toBe("<>");
  });

  it("toma el último segmento de una tabla calificada por esquema en ref inline", () => {
    expect(parseColumnSettings(["ref: > public.users.id"]).inlineRef?.table).toBe("users");
  });

  it("combina varios settings a la vez", () => {
    const result = parseColumnSettings(["pk", "not null", "increment"]);
    expect(result).toMatchObject({ isPrimaryKey: true, isNotNull: true, isIncrement: true });
  });

  it("ignora settings desconocidos sin lanzar", () => {
    expect(() => parseColumnSettings(["color: red"])).not.toThrow();
  });
});

describe("parseTableSettings", () => {
  it("interpreta headercolor", () => {
    expect(parseTableSettings(["headercolor: #3b82f6"]).headerColor).toBe("#3b82f6");
  });

  it("interpreta note", () => {
    expect(parseTableSettings(["note: 'tabla principal'"]).note).toBe("tabla principal");
  });

  it("devuelve nulls cuando no hay settings", () => {
    expect(parseTableSettings([])).toEqual({ headerColor: null, note: null });
  });
});
