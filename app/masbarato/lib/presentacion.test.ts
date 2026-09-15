import { describe, expect, it } from "vitest";
import {
  calcularPrecioPorUnidad,
  extraerPresentacion,
  formatearPresentacion,
  formatearPrecioPorUnidad,
} from "./presentacion";

describe("extraerPresentacion", () => {
  it("reconoce mililitros pegados al número", () => {
    expect(extraerPresentacion("Gaseosa Cola 500ml")).toEqual({
      cantidad: 500,
      unidad: "ml",
    });
  });

  it("reconoce litros con decimal y los normaliza a mL", () => {
    expect(extraerPresentacion("Coca-Cola 1.5L")).toEqual({
      cantidad: 1500,
      unidad: "ml",
    });
  });

  it("reconoce kilos y los normaliza a gramos", () => {
    expect(extraerPresentacion("CHUNKY Cordero, Arroz y Salmón 12 kilos")).toEqual({
      cantidad: 12000,
      unidad: "g",
    });
  });

  it("reconoce gramos sin confundirlos con kilogramos", () => {
    expect(extraerPresentacion("Detergente en polvo 900 g")).toEqual({
      cantidad: 900,
      unidad: "g",
    });
  });

  it("reconoce multipacks y multiplica por la cantidad de unidades", () => {
    expect(extraerPresentacion("Jabón en barra 3x125g")).toEqual({
      cantidad: 375,
      unidad: "g",
    });
  });

  it("devuelve null cuando el nombre no trae presentación reconocible", () => {
    expect(extraerPresentacion("TV KALLEY 60 Pulgadas 4K-UHD")).toBeNull();
  });
});

describe("calcularPrecioPorUnidad + formatearPrecioPorUnidad", () => {
  it("calcula precio por litro a partir de mL", () => {
    const precioPorUnidad = calcularPrecioPorUnidad(3000, {
      cantidad: 1500,
      unidad: "ml",
    });
    expect(precioPorUnidad).toEqual({ valor: 2000, unidad: "L" });
    expect(formatearPrecioPorUnidad(precioPorUnidad)).toBe("$2.000/L");
  });

  it("calcula precio por kilogramo a partir de gramos", () => {
    const precioPorUnidad = calcularPrecioPorUnidad(9000, {
      cantidad: 900,
      unidad: "g",
    });
    expect(precioPorUnidad).toEqual({ valor: 10000, unidad: "kg" });
    expect(formatearPrecioPorUnidad(precioPorUnidad)).toBe("$10.000/kg");
  });
});

describe("formatearPresentacion", () => {
  it("muestra litros cuando la cantidad normalizada llega a 1000 mL", () => {
    expect(formatearPresentacion({ cantidad: 1500, unidad: "ml" })).toBe(
      "1,5 L",
    );
  });

  it("muestra mililitros cuando no llega a 1000", () => {
    expect(formatearPresentacion({ cantidad: 500, unidad: "ml" })).toBe(
      "500 ml",
    );
  });

  it("muestra kilogramos cuando la cantidad normalizada llega a 1000 g", () => {
    expect(formatearPresentacion({ cantidad: 2000, unidad: "g" })).toBe(
      "2 kg",
    );
  });

  it("muestra gramos cuando no llega a 1000", () => {
    expect(formatearPresentacion({ cantidad: 900, unidad: "g" })).toBe(
      "900 g",
    );
  });
});
