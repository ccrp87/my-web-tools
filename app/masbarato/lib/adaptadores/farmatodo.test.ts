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

  it("no descarta hits relevantes cuando Algolia resolvió género/número distinto al término (ej. 'paños húmedos' -> 'Toallitas Húmedas')", async () => {
    // Repro del bug real: Algolia sí encuentra el producto correcto, pero ni
    // "paños" ni "húmedos" aparecen tal cual en el nombre -> el filtro AND
    // literal los descartaba a todos y la tienda mostraba "sin resultados".
    const restaurar = mockearFetch([
      {
        mediaDescription: "Toallitas Húmedas Pequeñín Almendra x 300 und",
        fullPrice: 25000,
        hasStock: true,
      },
      {
        mediaDescription: "Toallitas Húmedas Winny Recién Nacido x 160 und",
        fullPrice: 18000,
        hasStock: true,
      },
    ]);

    try {
      const resultado = await crearAdaptadorFarmatodo().buscar("paños húmedos", 3);
      expect(resultado.resultados).toHaveLength(2);
    } finally {
      restaurar();
    }
  });

  it("sí filtra cuando algún hit relevante coincide literalmente y otros no tienen relación", async () => {
    const restaurar = mockearFetch([
      { mediaDescription: "Aceite de Oliva Extra Virgen 500ml", fullPrice: 22000, hasStock: true },
      { mediaDescription: "Cepillo Dental Colgate", fullPrice: 8000, hasStock: true },
    ]);

    try {
      const resultado = await crearAdaptadorFarmatodo().buscar("aceite oliva", 3);
      expect(resultado.resultados).toHaveLength(1);
      expect(resultado.resultados[0]?.nombre).toBe(
        "Aceite de Oliva Extra Virgen 500ml",
      );
    } finally {
      restaurar();
    }
  });
});
