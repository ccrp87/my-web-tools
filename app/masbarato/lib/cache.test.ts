import { describe, expect, it } from "vitest";
import { crearCache } from "./cache";

describe("crearCache", () => {
  it("devuelve null para una clave nunca guardada", () => {
    const cache = crearCache<string>(1000);
    expect(cache.leer("x")).toBeNull();
  });

  it("devuelve lo guardado mientras no expire", () => {
    const cache = crearCache<string>(1000);
    cache.guardar("x", "valor", 0);
    expect(cache.leer("x", 500)).toBe("valor");
    expect(cache.leer("x", 999)).toBe("valor");
  });

  it("expira pasado el TTL y no lo devuelve más", () => {
    const cache = crearCache<string>(1000);
    cache.guardar("x", "valor", 0);
    expect(cache.leer("x", 1001)).toBeNull();
    expect(cache.leer("x", 2000)).toBeNull();
  });

  it("mantiene claves distintas de forma independiente", () => {
    const cache = crearCache<string>(1000);
    cache.guardar("a", "1", 0);
    cache.guardar("b", "2", 0);
    expect(cache.leer("a", 100)).toBe("1");
    expect(cache.leer("b", 100)).toBe("2");
  });
});
