import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Resultado } from "../tipos";

// El vector de cada texto sale de este mapa fijo por test: así se controla
// el puntaje de similitud exacto sin depender del modelo real (pesado y
// no determinístico de instalar en CI).
let vectoresPorTexto: Map<string, number[]>;

function resultado(nombre: string): Resultado {
  return { tienda: "Falsa", nombre, precio: 1000, disponible: true };
}

describe("rerankearPorSimilitud", () => {
  beforeEach(() => {
    vi.resetModules();
    vectoresPorTexto = new Map();
    vi.doMock("@xenova/transformers", () => ({
      pipeline: vi.fn(async () => {
        return async (textos: string[]) => ({
          tolist: () =>
            textos.map((t) => {
              const vector = vectoresPorTexto.get(t);
              if (!vector) {
                throw new Error(`vector no configurado para: "${t}"`);
              }
              return vector;
            }),
        });
      }),
    }));
  });

  it("descarta candidatos por debajo del umbral y ordena por similitud descendente", async () => {
    vectoresPorTexto.set("aceite oliva", [1, 0, 0]); // consulta
    vectoresPorTexto.set("Aceite Genérico Oliva Extra Virgen", [0.9, 0, 0]);
    vectoresPorTexto.set("Papel Higiénico Familia x12", [0.05, 0, 0]);
    vectoresPorTexto.set("Aceitunas Rellenas x200g", [0.5, 0, 0]);

    const { rerankearPorSimilitud } = await import("./similitud");
    const salida = await rerankearPorSimilitud(
      "aceite oliva",
      [
        resultado("Papel Higiénico Familia x12"),
        resultado("Aceitunas Rellenas x200g"),
        resultado("Aceite Genérico Oliva Extra Virgen"),
      ],
      10,
      () => {},
    );

    expect(salida.map((r) => r.nombre)).toEqual([
      "Aceite Genérico Oliva Extra Virgen",
      "Aceitunas Rellenas x200g",
    ]);
  });

  it("recorta al límite pedido después de rankear", async () => {
    vectoresPorTexto.set("aceite", [1, 0]);
    vectoresPorTexto.set("Aceite A", [0.9, 0]);
    vectoresPorTexto.set("Aceite B", [0.8, 0]);
    vectoresPorTexto.set("Aceite C", [0.7, 0]);

    const { rerankearPorSimilitud } = await import("./similitud");
    const salida = await rerankearPorSimilitud(
      "aceite",
      [resultado("Aceite C"), resultado("Aceite A"), resultado("Aceite B")],
      2,
      () => {},
    );

    expect(salida.map((r) => r.nombre)).toEqual(["Aceite A", "Aceite B"]);
  });

  it("no llama al modelo cuando no hay candidatos", async () => {
    const { rerankearPorSimilitud } = await import("./similitud");
    const salida = await rerankearPorSimilitud("aceite", [], 10, () => {});
    expect(salida).toEqual([]);
  });
});
