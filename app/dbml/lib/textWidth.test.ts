import { describe, expect, it } from "vitest";
import { estimateTextWidth } from "./textWidth";

describe("estimateTextWidth", () => {
  it("es proporcional a la longitud del texto", () => {
    const short = estimateTextWidth("abc", 14);
    const long = estimateTextWidth("abcabcabc", 14);
    expect(long).toBeCloseTo(short * 3, 5);
  });

  it("es proporcional al tamaño de fuente", () => {
    const small = estimateTextWidth("abcdef", 10);
    const large = estimateTextWidth("abcdef", 20);
    expect(large).toBeCloseTo(small * 2, 5);
  });

  it("devuelve 0 para texto vacío", () => {
    expect(estimateTextWidth("", 14)).toBe(0);
  });
});
