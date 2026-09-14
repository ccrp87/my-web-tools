import { describe, expect, it } from "vitest";
import { calcularMejor } from "./resultados";
import type { RespuestaTienda } from "./tipos";

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
});
