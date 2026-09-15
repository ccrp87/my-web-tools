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

  it("reconoce conteo por unidades cuando la palabra es explícita", () => {
    expect(extraerPresentacion("Panales BabySec x50 unidades")).toEqual({
      cantidad: 50,
      unidad: "unidad",
    });
  });

  it("reconoce la abreviatura 'uds'", () => {
    expect(extraerPresentacion("Jabón en barra 3 uds")).toEqual({
      cantidad: 3,
      unidad: "unidad",
    });
  });

  it("no confunde un 'x' suelto sin la palabra 'unidades' con conteo (ej. tallas o medidas)", () => {
    expect(extraerPresentacion("Camiseta Talla X 3")).toBeNull();
  });
});

describe("calcularPrecioPorUnidad + formatearPrecioPorUnidad", () => {
  it("calcula precio por mililitro a partir de mL", () => {
    const precioPorUnidad = calcularPrecioPorUnidad(3000, {
      cantidad: 1500,
      unidad: "ml",
    });
    expect(precioPorUnidad).toEqual({ valor: 2, unidad: "ml" });
    expect(formatearPrecioPorUnidad(precioPorUnidad)).toBe("$2/ml");
  });

  it("calcula precio por gramo a partir de gramos", () => {
    const precioPorUnidad = calcularPrecioPorUnidad(9000, {
      cantidad: 900,
      unidad: "g",
    });
    expect(precioPorUnidad).toEqual({ valor: 10, unidad: "g" });
    expect(formatearPrecioPorUnidad(precioPorUnidad)).toBe("$10/g");
  });

  it("muestra hasta 2 decimales cuando el precio por unidad queda por debajo de $1", () => {
    const precioPorUnidad = calcularPrecioPorUnidad(900, {
      cantidad: 3000,
      unidad: "ml",
    });
    expect(precioPorUnidad.valor).toBeCloseTo(0.3);
    expect(formatearPrecioPorUnidad(precioPorUnidad)).toBe("$0,3/ml");
  });

  it("calcula precio por unidad individual cuando la presentación es un conteo", () => {
    const precioPorUnidad = calcularPrecioPorUnidad(30000, {
      cantidad: 50,
      unidad: "unidad",
    });
    expect(precioPorUnidad).toEqual({ valor: 600, unidad: "unidad" });
    expect(formatearPrecioPorUnidad(precioPorUnidad)).toBe("$600/u");
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

  it("muestra el conteo como 'uds' sin agruparlo en L/kg", () => {
    expect(formatearPresentacion({ cantidad: 12, unidad: "unidad" })).toBe(
      "12 uds",
    );
  });
});
