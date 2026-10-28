import { describe, expect, it } from "vitest";
import { stripComments } from "./stripComments";

describe("stripComments", () => {
  it("quita comentarios de línea //", () => {
    expect(stripComments("Table a { // comentario\n id int\n}")).toBe(
      "Table a { \n id int\n}",
    );
  });

  it("quita comentarios de bloque /* */ en una sola línea, preservando el largo", () => {
    const input = "Table a /* nota */ { id int }";
    const result = stripComments(input);
    expect(result.length).toBe(input.length);
    expect(result).not.toContain("nota");
    expect(result.startsWith("Table a")).toBe(true);
    expect(result.endsWith("{ id int }")).toBe(true);
  });

  it("quita comentarios de bloque que cruzan varias líneas conservando los saltos", () => {
    const input = "Table a {\n/* esto\nes un\ncomentario */\n id int\n}";
    const result = stripComments(input);
    expect(result).not.toContain("comentario");
    expect(result.split("\n").length).toBe(input.split("\n").length);
  });

  it("no trata // dentro de comillas como comentario", () => {
    expect(stripComments("Table a { note: 'http://x.com' }")).toBe(
      "Table a { note: 'http://x.com' }",
    );
  });

  it("no trata /* dentro de comillas como comentario", () => {
    expect(stripComments("Table a { note: '/* no es comentario */' }")).toBe(
      "Table a { note: '/* no es comentario */' }",
    );
  });

  it("conserva el largo total del texto cuando hay comentario de bloque sin cerrar", () => {
    const input = "Table a { /* sin cerrar";
    const result = stripComments(input);
    expect(result.length).toBe(input.length);
  });
});
