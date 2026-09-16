import { describe, expect, it, vi } from "vitest";
import { crearAdaptadorCruzVerde } from "./cruzverde";

interface RespuestasSimuladas {
  sugeridos: Array<{ productId: string; categoryName?: string }>;
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

  it("nunca pide más de 10 sugerencias, aunque el modo IA pida un límite mayor (search-suggestions responde HTTP 400 por encima de eso)", async () => {
    const original = globalThis.fetch;
    const urlsPedidas: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      urlsPedidas.push(url);
      if (url.includes("customer-service/login")) {
        return new Response("{}", {
          status: 201,
          headers: { "set-cookie": "connect.sid=abc123; Path=/;" },
        });
      }
      if (url.includes("search-suggestions")) {
        return new Response(
          JSON.stringify({ productSuggestions: { products: [] } }),
          { status: 200 },
        );
      }
      throw new Error(`URL inesperada en el mock: ${url}`);
    }) as typeof fetch;

    try {
      await crearAdaptadorCruzVerde().buscar("aceite oliva", 20, { crudo: true });
      const urlSugerencias = urlsPedidas.find((u) => u.includes("search-suggestions"));
      expect(urlSugerencias).toContain("limit=10");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("con opciones.crudo no descarta sugerencias sin relación literal", async () => {
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
        { crudo: true },
      );
      expect(resultado.resultados).toHaveLength(1);
    } finally {
      restaurar();
    }
  });

  it("lee la categoría desde search-suggestions (no viene en product-summary)", async () => {
    const restaurar = mockearFetch({
      sugeridos: [{ productId: "3", categoryName: "Facial" }],
      detalles: {
        "3": {
          name: "Barra Solar Uriage Invisible Spf50",
          brand: "Uriage",
          stock: 5,
          prices: { "price-sale-col": 127110 },
        },
      },
    });

    try {
      const resultado = await crearAdaptadorCruzVerde().buscar("solar", 3);
      expect(resultado.resultados[0]?.categoria).toBe("Facial");
    } finally {
      restaurar();
    }
  });
});
