import { describe, expect, it } from "vitest";
import { getSvgPixelDimensions } from "./svgDimensions";

describe("getSvgPixelDimensions", () => {
  it("lee width y height cuando están presentes", () => {
    const svg = `<svg width="320.5" height="140" viewBox="0 0 1000 500"><g></g></svg>`;
    expect(getSvgPixelDimensions(svg)).toEqual({ width: 320.5, height: 140 });
  });

  it("usa el viewBox cuando faltan width/height", () => {
    const svg = `<svg viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg"><g></g></svg>`;
    expect(getSvgPixelDimensions(svg)).toEqual({ width: 640, height: 480 });
  });

  it("devuelve un tamaño por defecto si no hay datos de tamaño", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg>`;
    expect(getSvgPixelDimensions(svg)).toEqual({ width: 800, height: 600 });
  });

  it("ignora un viewBox malformado y usa el tamaño por defecto", () => {
    const svg = `<svg viewBox="0 0 640"><g></g></svg>`;
    expect(getSvgPixelDimensions(svg)).toEqual({ width: 800, height: 600 });
  });
});
