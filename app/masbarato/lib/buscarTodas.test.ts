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
    expect(cache.leer("Falsa|acetaminofen|3|filtrado")).toEqual({
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

  it("pasa las opciones al adaptador y cachea modo crudo aparte del filtrado", async () => {
    const buscar = vi
      .fn()
      .mockResolvedValueOnce({ tienda: "Falsa", resultados: [{ nombre: "filtrado" }] })
      .mockResolvedValueOnce({ tienda: "Falsa", resultados: [{ nombre: "crudo" }] });
    const adaptador = adaptadorFalso(buscar);
    const cache = crearCache<RespuestaTienda>();

    const filtrada = await buscarEnTienda(adaptador, "aceite", 3, cache);
    const cruda = await buscarEnTienda(adaptador, "aceite", 3, cache, { crudo: true });

    expect(buscar).toHaveBeenCalledTimes(2);
    expect(buscar).toHaveBeenNthCalledWith(1, "aceite", 3, {});
    expect(buscar).toHaveBeenNthCalledWith(2, "aceite", 3, { crudo: true });
    expect(filtrada.respuesta.resultados).toEqual([{ nombre: "filtrado" }]);
    expect(cruda.respuesta.resultados).toEqual([{ nombre: "crudo" }]);
  });

  it("no cachea una respuesta con error, para poder reintentar en la siguiente búsqueda", async () => {
    const buscar = vi
      .fn()
      .mockResolvedValueOnce({ tienda: "Falsa", resultados: [], error: "timeout" })
      .mockResolvedValueOnce({ tienda: "Falsa", resultados: [{ nombre: "Aceite" }] });
    const adaptador = adaptadorFalso(buscar);
    const cache = crearCache<RespuestaTienda>();

    const primera = await buscarEnTienda(adaptador, "aceite", 3, cache);
    const segunda = await buscarEnTienda(adaptador, "aceite", 3, cache);

    expect(primera.respuesta.error).toBe("timeout");
    expect(segunda.deCache).toBe(false);
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(segunda.respuesta.resultados).toEqual([{ nombre: "Aceite" }]);
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
