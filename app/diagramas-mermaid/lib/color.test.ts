import { describe, expect, it } from "vitest";
import { rgbStringToHex } from "./color";

describe("rgbStringToHex", () => {
  it("convierte rgb() a hexadecimal", () => {
    expect(rgbStringToHex("rgb(31, 32, 32)")).toBe("#1f2020");
  });

  it("convierte rgba() a hexadecimal, ignorando el canal alfa", () => {
    expect(rgbStringToHex("rgba(255, 0, 128, 0.5)")).toBe("#ff0080");
  });

  it("redondea componentes con decimales", () => {
    expect(rgbStringToHex("rgb(10.6, 0, 0)")).toBe("#0b0000");
  });

  it("devuelve null para valores que no son rgb()/rgba()", () => {
    expect(rgbStringToHex("none")).toBeNull();
    expect(rgbStringToHex("transparent")).toBeNull();
    expect(rgbStringToHex("#ff0000")).toBeNull();
  });
});
