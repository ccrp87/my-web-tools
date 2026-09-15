import { describe, expect, it } from "vitest";
import { crearAdaptadorVtex } from "./vtex";

function mockearFetch(cuerpo: unknown): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(cuerpo), { status: 200 })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe("adaptador VTEX", () => {
  it("lee la presentación nativa (PUM) cuando la unidad es de volumen o peso", async () => {
    const restaurar = mockearFetch([
      {
        productName: "Aceite Diana 1000 ml",
        brand: "Diana",
        link: "/aceite-diana-1000-ml/p",
        items: [
          {
            images: [{ imageUrl: "https://cdn/aceite.jpg" }],
            sellers: [{ commertialOffer: { Price: 8000, AvailableQuantity: 5 } }],
          },
        ],
        "Factor Neto PUM": ["1000"],
        "Unidad de Medida PUM Calculado": ["Mililitro"],
      },
    ]);

    try {
      const resultado = await crearAdaptadorVtex("Éxito", "https://www.exito.com/io").buscar(
        "aceite",
        3,
      );
      expect(resultado.resultados[0]?.presentacion).toEqual({
        cantidad: 1000,
        unidad: "ml",
      });
    } finally {
      restaurar();
    }
  });

  it("lee la presentación por conteo cuando la unidad PUM es 'Unidad' (ej. un paquete de varias piezas)", async () => {
    const restaurar = mockearFetch([
      {
        productName: "Cuchara Extracta x12",
        items: [
          { sellers: [{ commertialOffer: { Price: 36000, AvailableQuantity: 5 } }] },
        ],
        "Factor Neto PUM": ["12"],
        "Unidad de Medida PUM Calculado": ["Unidad"],
      },
    ]);

    try {
      const resultado = await crearAdaptadorVtex("Éxito", "https://www.exito.com/io").buscar(
        "cuchara",
        3,
      );
      expect(resultado.resultados[0]?.presentacion).toEqual({
        cantidad: 12,
        unidad: "unidad",
      });
    } finally {
      restaurar();
    }
  });

  it("no reporta presentación cuando el producto no trae especificación PUM", async () => {
    const restaurar = mockearFetch([
      {
        productName: "Producto sin specs",
        items: [
          { sellers: [{ commertialOffer: { Price: 3000, AvailableQuantity: 5 } }] },
        ],
      },
    ]);

    try {
      const resultado = await crearAdaptadorVtex("Éxito", "https://www.exito.com/io").buscar(
        "x",
        3,
      );
      expect(resultado.resultados[0]?.presentacion).toBeUndefined();
    } finally {
      restaurar();
    }
  });

  it("lee la categoría más específica (último segmento de la primera ruta)", async () => {
    const restaurar = mockearFetch([
      {
        productName: "Atún Van Camps en Aceite de Oliva",
        items: [
          { sellers: [{ commertialOffer: { Price: 8000, AvailableQuantity: 5 } }] },
        ],
        categories: [
          "/Mercado/Despensa/Enlatados y conservas/",
          "/Mercado/Despensa/",
          "/Mercado/",
        ],
      },
    ]);

    try {
      const resultado = await crearAdaptadorVtex("Éxito", "https://www.exito.com/io").buscar(
        "aceite oliva",
        3,
      );
      expect(resultado.resultados[0]?.categoria).toBe("Enlatados y conservas");
    } finally {
      restaurar();
    }
  });
});
