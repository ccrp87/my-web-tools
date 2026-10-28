import { describe, expect, it } from "vitest";
import { DARK_PALETTE, LIGHT_PALETTE, getPalette } from "./palette";

describe("getPalette", () => {
  it("devuelve la paleta clara cuando isDarkTheme es false", () => {
    expect(getPalette(false)).toBe(LIGHT_PALETTE);
  });

  it("devuelve la paleta oscura cuando isDarkTheme es true", () => {
    expect(getPalette(true)).toBe(DARK_PALETTE);
  });
});
