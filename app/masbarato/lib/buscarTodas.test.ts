import { describe, expect, it, vi } from "vitest";
import { buscarEnTienda, crearFlujoBusqueda } from "./buscarTodas";
import { crearCache } from "./cache";
import type { Adaptador } from "./adaptadores/tipos";
import type { RespuestaTienda } from "./tipos";

function adaptadorFalso(buscar: Adaptador["buscar"]): Adaptador {
  return { tienda: "Falsa", buscar };
}

describe("buscarEnTienda", () => {
  it("consulta el adaptador y guarda el resultado en caché", async () => {
    const buscar = vi.fn().mockResolvedValue({ tienda: "Falsa", resultados: [] });
    const adaptador = adaptadorFalso(buscar);
    const cache = crearCache<RespuestaTienda>();

    const evento = await buscarEnTienda(adaptador, "acetaminofen", 3, cache);

    expect(evento.deCache).toBe(false);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(cache.leer("Falsa|acetaminofen|3")).toEqual({
      tienda: "Falsa",
      resultados: [],
    });
  });

  it("no vuelve a llamar al adaptador si ya está en caché", async () => {
    const buscar = vi.fn().mockResolvedValue({ tienda: "Falsa", resultados: [] });
    const adaptador = adaptadorFalso(buscar);
    const cache = crearCache<RespuestaTienda>();

    await buscarEnTienda(adaptador, "acetaminofen", 3, cache);
    const segundaVez = await buscarEnTienda(adaptador, "acetaminofen", 3, cache);

    expect(segundaVez.deCache).toBe(true);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("convierte una excepción del adaptador en una respuesta con error", async () => {
    const buscar = vi.fn().mockRejectedValue(new Error("boom"));
    const adaptador = adaptadorFalso(buscar);
    const cache = crearCache<RespuestaTienda>();

    const evento = await buscarEnTienda(adaptador, "x", 3, cache);

    expect(evento.deCache).toBe(false);
    expect(evento.respuesta.error).toBe("boom");
    expect(evento.respuesta.resultados).toEqual([]);
  });
});

async function leerEventos(flujo: ReadableStream<Uint8Array>): Promise<EventoBusquedaLeido[]> {
  const texto = await new Response(flujo).text();
  return texto
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as EventoBusquedaLeido);
}

interface EventoBusquedaLeido {
  respuesta: RespuestaTienda;
  deCache: boolean;
}

describe("crearFlujoBusqueda", () => {
  it("solo consulta las tiendas pasadas explícitamente, no todo TIENDAS", async () => {
    const buscarA = vi.fn().mockResolvedValue({ tienda: "A", resultados: [] });
    const buscarB = vi.fn().mockResolvedValue({ tienda: "B", resultados: [] });
    const adaptadores: Adaptador[] = [
      { tienda: "A", buscar: buscarA },
      { tienda: "B", buscar: buscarB },
    ];
    const cache = crearCache<RespuestaTienda>();

    const eventos = await leerEventos(
      crearFlujoBusqueda("x", 3, cache, [adaptadores[0]]),
    );

    expect(eventos).toHaveLength(1);
    expect(eventos[0].respuesta.tienda).toBe("A");
    expect(buscarA).toHaveBeenCalledTimes(1);
    expect(buscarB).not.toHaveBeenCalled();
  });
});
