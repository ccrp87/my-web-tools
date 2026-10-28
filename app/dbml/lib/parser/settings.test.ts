import { describe, expect, it } from "vitest";
import { splitSettingsList, unquote } from "./settings";

describe("splitSettingsList", () => {
  it("separa settings simples por coma", () => {
    expect(splitSettingsList("pk, not null, unique")).toEqual([
      "pk",
      "not null",
      "unique",
    ]);
  });

  it("no separa comas dentro de comillas", () => {
    expect(splitSettingsList("default: 'a, b, c', not null")).toEqual([
      "default: 'a, b, c'",
      "not null",
    ]);
  });

  it("ignora espacios sobrantes y entradas vacías", () => {
    expect(splitSettingsList("  pk ,  , unique  ")).toEqual(["pk", "unique"]);
  });

  it("devuelve lista vacía para texto vacío", () => {
    expect(splitSettingsList("")).toEqual([]);
  });
});

describe("unquote", () => {
  it("quita comillas simples", () => {
    expect(unquote("'hola'")).toBe("hola");
  });

  it("quita comillas dobles", () => {
    expect(unquote('"hola"')).toBe("hola");
  });

  it("no toca texto sin comillas", () => {
    expect(unquote("hola")).toBe("hola");
  });

  it("recorta espacios antes de evaluar comillas", () => {
    expect(unquote("  'hola'  ")).toBe("hola");
  });

  it("no quita una sola comilla suelta", () => {
    expect(unquote("'")).toBe("'");
  });
});
