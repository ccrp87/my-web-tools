import { describe, expect, it } from "vitest";
import { formatearPrecio, limpiarPrecio } from "./precio";

describe("formatearPrecio", () => {
  it("formatea con punto de miles", () => {
    expect(formatearPrecio(12500)).toBe("$12.500");
  });

  it("redondea decimales", () => {
    expect(formatearPrecio(12500.7)).toBe("$12.501");
  });

  it("muestra un guion largo cuando no hay precio", () => {
    expect(formatearPrecio(null)).toBe("—");
  });
});

describe("limpiarPrecio", () => {
  it("interpreta el formato colombiano (punto=miles, coma=decimal)", () => {
    expect(limpiarPrecio("$ 12.500,00")).toBe(12500);
  });

  it("interpreta miles sin parte decimal", () => {
    expect(limpiarPrecio("$12.500")).toBe(12500);
  });

  it("devuelve null para texto vacío", () => {
    expect(limpiarPrecio("")).toBeNull();
  });

  it("devuelve null si no queda nada numérico", () => {
    expect(limpiarPrecio("agotado")).toBeNull();
  });
});
