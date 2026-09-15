import { describe, expect, it } from "vitest";
import { crearAdaptadorCruzVerde } from "./cruzverde";

interface RespuestasSimuladas {
  sugeridos: Array<{ productId: string }>;
  detalles: Record<
    string,
    { name: string; brand?: string; stock?: number; prices?: Record<string, number> }
  >;
}

function mockearFetch(datos: RespuestasSimuladas): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("customer-service/login")) {
      return new Response("{}", {
        status: 201,
        headers: { "set-cookie": "connect.sid=abc123; Path=/;" },
      });
    }
    if (url.includes("search-suggestions")) {
      return new Response(
        JSON.stringify({ productSuggestions: { products: datos.sugeridos } }),
        { status: 200 },
      );
    }
    if (url.includes("product-summary")) {
      return new Response(JSON.stringify(datos.detalles), { status: 200 });
    }
    if (url.includes("/detail/")) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    throw new Error(`URL inesperada en el mock: ${url}`);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}

describe("adaptador Cruz Verde", () => {
  it("descarta sugerencias sin relación real con el término (autocorrección de search-suggestions)", async () => {
    // Repro del bug real: "aceite de oliva" -> search-suggestions corrige
    // "aceite" a "active" y sugiere un protector solar sin relación.
    const restaurar = mockearFetch({
      sugeridos: [{ productId: "1" }],
      detalles: {
        "1": {
          name: "Protector Solar Uriage Eau Thermale Bariesun Spf50+ Fco 200Ml Spray",
          brand: "Uriage",
          stock: 5,
          prices: { "price-sale-col": 161927 },
        },
      },
    });

    try {
      const resultado = await crearAdaptadorCruzVerde().buscar(
        "aceite de oliva",
        3,
      );
      expect(resultado.resultados).toEqual([]);
    } finally {
      restaurar();
    }
  });

  it("conserva sugerencias que sí contienen todas las palabras significativas", async () => {
    const restaurar = mockearFetch({
      sugeridos: [{ productId: "2" }],
      detalles: {
        "2": {
          name: "Aceite de oliva extra virgen 500ml",
          brand: "Genérico",
          stock: 5,
          prices: { "price-sale-col": 12000 },
        },
      },
    });

    try {
      const resultado = await crearAdaptadorCruzVerde().buscar(
        "aceite de oliva",
        3,
      );
      expect(resultado.resultados).toHaveLength(1);
      expect(resultado.resultados[0]?.nombre).toContain("Aceite de oliva");
    } finally {
      restaurar();
    }
  });
});
