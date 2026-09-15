import { describe, expect, it } from "vitest";
import { tokenizarTermino } from "./tokenizar";

describe("tokenizarTermino", () => {
  it("una sola palabra queda como clave sin filtros", () => {
    expect(tokenizarTermino("ibuprofeno")).toEqual({
      clave: "ibuprofeno",
      filtros: [],
    });
  });

  it("manda todas las palabras significativas unidas por guion, no solo la más larga", () => {
    expect(tokenizarTermino("acetaminofen 500")).toEqual({
      clave: "acetaminofen-500",
      filtros: ["acetaminofen", "500"],
    });
  });

  it("descarta palabras vacías ('de', 'y', etc.) para no diluir la búsqueda", () => {
    // Antes se mandaba solo "aceite" (la más larga) y se perdía "oliva",
    // la palabra que realmente distingue el producto buscado.
    expect(tokenizarTermino("aceite de oliva")).toEqual({
      clave: "aceite-oliva",
      filtros: ["aceite", "oliva"],
    });
  });

  it("si todas las palabras son vacías, usa el término tal cual en vez de quedar vacío", () => {
    expect(tokenizarTermino("de la")).toEqual({
      clave: "de-la",
      filtros: ["de", "la"],
    });
  });

  it("conserva tildes y eñes como caracteres de palabra", () => {
    const { clave } = tokenizarTermino("acetaminofén");
    expect(clave).toBe("acetaminofén");
  });

  it("ignora espacios y signos de puntuación repetidos", () => {
    expect(tokenizarTermino("ibuprofeno,  600mg.")).toEqual({
      clave: "ibuprofeno-600mg",
      filtros: ["ibuprofeno", "600mg"],
    });
  });

  it("con texto vacío devuelve el término tal cual y sin filtros", () => {
    expect(tokenizarTermino("   ")).toEqual({ clave: "", filtros: [] });
  });
});
