import { describe, expect, it } from "vitest";
import { crearAdaptadorFarmatodo } from "./farmatodo";

function mockearFetch(hits: unknown[]): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ results: [{ hits }] }), {
      status: 200,
    })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe("adaptador Farmatodo", () => {
  it("lee la categoría más específica de 'classification' (mayor typeId)", async () => {
    const restaurar = mockearFetch([
      {
        mediaDescription: "Aceite de Oliva Olivetto Suave Botella x 250 ml",
        fullPrice: 15000,
        hasStock: true,
        classification: [
          { id: 71, name: "Alimentos y bebidas", typeId: 1, typeName: "DEPARTAMENTO" },
          { id: 78, name: "Despensa", typeId: 2, typeName: "CATEGORIA" },
          {
            id: 110,
            name: "Sopas, salsas y aderezos",
            typeId: 3,
            typeName: "SUBCATEGORIA",
          },
        ],
      },
    ]);

    try {
      const resultado = await crearAdaptadorFarmatodo().buscar("aceite oliva", 3);
      expect(resultado.resultados[0]?.categoria).toBe("Sopas, salsas y aderezos");
    } finally {
      restaurar();
    }
  });

  it("cae a 'categorie' cuando no viene 'classification'", async () => {
    const restaurar = mockearFetch([
      {
        mediaDescription: "Aceite de Oliva",
        fullPrice: 15000,
        hasStock: true,
        categorie: "Despensa",
      },
    ]);

    try {
      const resultado = await crearAdaptadorFarmatodo().buscar("aceite oliva", 3);
      expect(resultado.resultados[0]?.categoria).toBe("Despensa");
    } finally {
      restaurar();
    }
  });

  it("no falla cuando no hay ninguna categoría disponible", async () => {
    const restaurar = mockearFetch([
      { mediaDescription: "Producto sin categoría", fullPrice: 5000, hasStock: true },
    ]);

    try {
      const resultado = await crearAdaptadorFarmatodo().buscar("x", 3);
      expect(resultado.resultados[0]?.categoria).toBeUndefined();
    } finally {
      restaurar();
    }
  });
});
