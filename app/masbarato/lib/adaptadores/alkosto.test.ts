import { describe, expect, it } from "vitest";
import { crearAdaptadorAlkosto } from "./alkosto";

// precioAlkosto no se exporta (es detalle interno); se prueba a través del
// adaptador simulando fetch, igual de simple que un test unitario directo
// pero verificando también el resto del mapeo (url, imagen, marca).
describe("adaptador Alkosto", () => {
  it("usa discountprice_double cuando hay descuento activo", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              name_text_es: "TV KALLEY 60 Pulgadas",
              marca_text: "KALLEY",
              code_string: "123",
              url_es_string: "/tv-kalley-60/p/123",
              pricevalue_cop_double: 3899900,
              discountprice_double: 1699900,
              instockflag_boolean: true,
              "img-310wx310h_string": "https://cdn.dam.alkosto.com/123.jpg",
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const resultado = await crearAdaptadorAlkosto().buscar("televisor", 3);
      expect(resultado.resultados).toEqual([
        {
          tienda: "Alkosto",
          nombre: "TV KALLEY 60 Pulgadas",
          precio: 1699900,
          disponible: true,
          marca: "KALLEY",
          url: "https://www.alkosto.com/tv-kalley-60/p/123",
          imagen: "https://cdn.dam.alkosto.com/123.jpg",
        },
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("descarta hits sin relación real con un término de varias palabras (índice ordenado por precio, no relevancia)", async () => {
    // Repro del bug real: "winny pants 5" no tiene coincidencias en Alkosto,
    // pero el índice ordenado por precio devuelve productos baratos de
    // cualquier categoría en vez de nada.
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              name_text_es: "Copa Melamina FREE HOME Larga 20 cm",
              pricevalue_cop_double: 5340,
              instockflag_boolean: true,
            },
            {
              name_text_es: "Cable KALLEY Uno a Uno 3.5mm de 1.0 Metro Negro",
              pricevalue_cop_double: 9200,
              instockflag_boolean: true,
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const resultado = await crearAdaptadorAlkosto().buscar("winny pants 5", 10);
      expect(resultado.resultados).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("conserva hits que sí contienen todas las palabras significativas de un término de varias palabras", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              name_text_es: "Aceite de Oliva Extra Virgen 500ml",
              pricevalue_cop_double: 12000,
              instockflag_boolean: true,
            },
            {
              name_text_es: "Copa Melamina FREE HOME Larga 20 cm",
              pricevalue_cop_double: 5340,
              instockflag_boolean: true,
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const resultado = await crearAdaptadorAlkosto().buscar("aceite oliva", 10);
      expect(resultado.resultados).toHaveLength(1);
      expect(resultado.resultados[0]?.nombre).toBe(
        "Aceite de Oliva Extra Virgen 500ml",
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it("lee la categoría más específica (último elemento de categoryname_text_es_mv)", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              name_text_es: "Cojín Decorativo K-LINE Olivillo 50 x 50 cm",
              pricevalue_cop_double: 30000,
              instockflag_boolean: true,
              categoryname_text_es_mv: ["Hogar", "Decoración", "Cojines"],
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const resultado = await crearAdaptadorAlkosto().buscar("cojin", 3);
      expect(resultado.resultados[0]?.categoria).toBe("Cojines");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("usa pricevalue_cop_double cuando no hay descuento", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          hits: [
            {
              name_text_es: "Arroz",
              pricevalue_cop_double: 174900,
              instockflag_boolean: true,
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const resultado = await crearAdaptadorAlkosto().buscar("arroz", 3);
      expect(resultado.resultados[0]?.precio).toBe(174900);
      expect(resultado.resultados[0]?.url).toBeUndefined();
    } finally {
      globalThis.fetch = original;
    }
  });
});
