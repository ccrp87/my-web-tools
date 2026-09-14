import { describe, expect, it } from "vitest";
import { tokenizarTermino } from "./tokenizar";

describe("tokenizarTermino", () => {
  it("una sola palabra queda como clave sin filtros", () => {
    expect(tokenizarTermino("ibuprofeno")).toEqual({
      clave: "ibuprofeno",
      filtros: [],
    });
  });

  it("elige la palabra más larga como clave y el resto como filtros", () => {
    expect(tokenizarTermino("acetaminofen 500")).toEqual({
      clave: "acetaminofen",
      filtros: ["500"],
    });
  });

  it("conserva tildes y eñes como caracteres de palabra", () => {
    const { clave } = tokenizarTermino("acetaminofén");
    expect(clave).toBe("acetaminofén");
  });

  it("ignora espacios y signos de puntuación repetidos", () => {
    expect(tokenizarTermino("ibuprofeno,  600mg.")).toEqual({
      clave: "ibuprofeno",
      filtros: ["600mg"],
    });
  });

  it("con texto vacío devuelve el término tal cual y sin filtros", () => {
    expect(tokenizarTermino("   ")).toEqual({ clave: "", filtros: [] });
  });
});
