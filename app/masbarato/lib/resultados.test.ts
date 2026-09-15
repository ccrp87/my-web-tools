import { describe, expect, it } from "vitest";
import { calcularMejor, ordenarPorPrecio } from "./resultados";
import type { Resultado, RespuestaTienda } from "./tipos";

function resp(parcial: Partial<RespuestaTienda> & { tienda: string }): RespuestaTienda {
  return { resultados: [], ...parcial };
}

describe("calcularMejor", () => {
  it("devuelve null si no hay resultados", () => {
    expect(calcularMejor([])).toBeNull();
  });

  it("devuelve null si ningún resultado tiene precio", () => {
    const respuestas = [
      resp({
        tienda: "A",
        resultados: [
          { tienda: "A", nombre: "x", precio: null, disponible: true },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)).toBeNull();
  });

  it("prefiere el más barato entre los disponibles", () => {
    const respuestas = [
      resp({
        tienda: "A",
        resultados: [
          { tienda: "A", nombre: "caro", precio: 20000, disponible: true },
        ],
      }),
      resp({
        tienda: "B",
        resultados: [
          { tienda: "B", nombre: "barato", precio: 10000, disponible: true },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)?.nombre).toBe("barato");
  });

  it("ignora el más barato si está agotado y hay uno disponible más caro", () => {
    const respuestas = [
      resp({
        tienda: "A",
        resultados: [
          {
            tienda: "A",
            nombre: "barato-agotado",
            precio: 5000,
            disponible: false,
          },
        ],
      }),
      resp({
        tienda: "B",
        resultados: [
          {
            tienda: "B",
            nombre: "caro-disponible",
            precio: 20000,
            disponible: true,
          },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)?.nombre).toBe("caro-disponible");
  });

  it("si todos están agotados, elige el más barato de todos", () => {
    const respuestas = [
      resp({
        tienda: "A",
        resultados: [
          { tienda: "A", nombre: "x", precio: 20000, disponible: false },
        ],
      }),
      resp({
        tienda: "B",
        resultados: [
          { tienda: "B", nombre: "y", precio: 10000, disponible: false },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)?.nombre).toBe("y");
  });

  it("con presentaciones distintas, decide por precio normalizado en vez de precio total", () => {
    const respuestas = [
      resp({
        tienda: "A",
        // Precio total más bajo, pero el frasco es de 250ml: más caro por litro.
        resultados: [
          {
            tienda: "A",
            nombre: "Aceite 250ml",
            precio: 6000,
            disponible: true,
          },
        ],
      }),
      resp({
        tienda: "B",
        // Precio total más alto, pero el frasco es de 1L: más barato por litro.
        resultados: [
          {
            tienda: "B",
            nombre: "Aceite 1L",
            precio: 15000,
            disponible: true,
          },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)?.nombre).toBe("Aceite 1L");
  });

  it("si 2 de 3 candidatos comparten unidad pero el tercero no tiene presentación, cae al precio total (no excluye al tercero en silencio)", () => {
    const respuestas = [
      resp({
        tienda: "A",
        resultados: [
          { tienda: "A", nombre: "Aceite 250ml", precio: 6000, disponible: true },
        ],
      }),
      resp({
        tienda: "B",
        resultados: [
          { tienda: "B", nombre: "Aceite 1L", precio: 15000, disponible: true },
        ],
      }),
      resp({
        tienda: "C",
        // El más barato de los tres en precio total, pero sin presentación reconocible.
        resultados: [
          { tienda: "C", nombre: "Aceite genérico", precio: 3000, disponible: true },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)?.nombre).toBe("Aceite genérico");
  });

  it("usa la presentación nativa del resultado (r.presentacion) en vez de adivinarla del nombre, si viene", () => {
    const respuestas = [
      resp({
        tienda: "A",
        resultados: [
          {
            tienda: "A",
            nombre: "Aceite sin unidad en el nombre",
            precio: 6000,
            disponible: true,
            presentacion: { cantidad: 250, unidad: "ml" },
          },
        ],
      }),
      resp({
        tienda: "B",
        resultados: [
          {
            tienda: "B",
            nombre: "Aceite sin unidad en el nombre",
            precio: 15000,
            disponible: true,
            presentacion: { cantidad: 1000, unidad: "ml" },
          },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)?.tienda).toBe("B");
  });

  it("si solo un candidato tiene presentación reconocible, cae al precio total", () => {
    const respuestas = [
      resp({
        tienda: "A",
        resultados: [
          {
            tienda: "A",
            nombre: "Aceite 250ml",
            precio: 6000,
            disponible: true,
          },
        ],
      }),
      resp({
        tienda: "B",
        resultados: [
          { tienda: "B", nombre: "Aceite genérico", precio: 4000, disponible: true },
        ],
      }),
    ];
    expect(calcularMejor(respuestas)?.nombre).toBe("Aceite genérico");
  });
});

describe("ordenarPorPrecio", () => {
  it("ordena de más barato a más caro por precio total", () => {
    const resultados: Resultado[] = [
      { tienda: "A", nombre: "caro", precio: 20000, disponible: true },
      { tienda: "B", nombre: "barato", precio: 10000, disponible: true },
    ];
    expect(ordenarPorPrecio(resultados).map((r) => r.nombre)).toEqual([
      "barato",
      "caro",
    ]);
  });

  it("deja al final los resultados sin precio, en su orden original", () => {
    const resultados: Resultado[] = [
      { tienda: "A", nombre: "sin-precio-1", precio: null, disponible: true },
      { tienda: "B", nombre: "barato", precio: 10000, disponible: true },
      { tienda: "C", nombre: "sin-precio-2", precio: null, disponible: true },
    ];
    expect(ordenarPorPrecio(resultados).map((r) => r.nombre)).toEqual([
      "barato",
      "sin-precio-1",
      "sin-precio-2",
    ]);
  });

  it("usa el mismo criterio normalizado que calcularMejor cuando todos son comparables", () => {
    const resultados: Resultado[] = [
      { tienda: "A", nombre: "Aceite 250ml", precio: 6000, disponible: true },
      { tienda: "B", nombre: "Aceite 1L", precio: 15000, disponible: true },
    ];
    // Por litro, A (250ml a 6000) sale más caro que B (1L a 15000): A=24000/L, B=15000/L.
    expect(ordenarPorPrecio(resultados).map((r) => r.tienda)).toEqual([
      "B",
      "A",
    ]);
  });
});
