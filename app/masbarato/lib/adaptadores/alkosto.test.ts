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
