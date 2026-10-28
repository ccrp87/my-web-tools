import { describe, expect, it } from "vitest";
import {
  findMatchingBrace,
  lineNumberAt,
  readLogicalLine,
  readNameToken,
  readQualifiedName,
  skipWhitespace,
} from "./cursor";

describe("lineNumberAt", () => {
  it("devuelve 1 para el inicio del texto", () => {
    expect(lineNumberAt("abc\ndef", 0)).toBe(1);
  });

  it("cuenta los saltos de línea antes del índice", () => {
    expect(lineNumberAt("a\nb\nc\nd", 6)).toBe(4);
  });

  it("cuenta correctamente justo después de un salto de línea", () => {
    expect(lineNumberAt("a\nb", 2)).toBe(2);
  });
});

describe("skipWhitespace", () => {
  it("salta espacios, tabs y saltos de línea", () => {
    expect(skipWhitespace("   \n\tabc", 0)).toBe(5);
  });

  it("no avanza si ya no hay espacio", () => {
    expect(skipWhitespace("abc", 0)).toBe(0);
  });
});

describe("readNameToken", () => {
  it("lee un identificador simple", () => {
    expect(readNameToken("users more", 0)).toEqual({ value: "users", nextIndex: 5 });
  });

  it("lee un identificador con guion bajo y números", () => {
    expect(readNameToken("user_id2 x", 0)).toEqual({ value: "user_id2", nextIndex: 8 });
  });

  it("lee una cadena entre comillas dobles", () => {
    expect(readNameToken('"nombre con espacios" resto', 0)).toEqual({
      value: "nombre con espacios",
      nextIndex: 21,
    });
  });

  it("devuelve null si no hay un token válido en esa posición", () => {
    expect(readNameToken("123abc", 0)).toBeNull();
    expect(readNameToken("", 0)).toBeNull();
  });

  it("devuelve null si la comilla doble no cierra", () => {
    expect(readNameToken('"sin cerrar', 0)).toBeNull();
  });
});

describe("readQualifiedName", () => {
  it("devuelve solo el último segmento de un nombre calificado", () => {
    expect(readQualifiedName("public.users resto", 0)).toEqual({
      value: "users",
      nextIndex: 12,
    });
  });

  it("funciona igual que readNameToken sin punto", () => {
    expect(readQualifiedName("users resto", 0)).toEqual({ value: "users", nextIndex: 5 });
  });

  it("soporta varios segmentos encadenados", () => {
    expect(readQualifiedName("a.b.c resto", 0)).toEqual({ value: "c", nextIndex: 5 });
  });
});

describe("findMatchingBrace", () => {
  it("encuentra el cierre al mismo nivel", () => {
    const text = "{ a: 1 }";
    expect(findMatchingBrace(text, 0)).toBe(7);
  });

  it("respeta el anidamiento", () => {
    const text = "{ a { b } c }";
    expect(findMatchingBrace(text, 0)).toBe(12);
  });

  it("ignora llaves dentro de comillas", () => {
    const text = "{ note: 'a } b' }";
    expect(findMatchingBrace(text, 0)).toBe(16);
  });

  it("ignora comillas escapadas", () => {
    const text = "{ note: 'it\\'s } fine' }";
    expect(findMatchingBrace(text, 0)).toBe(23);
  });

  it("soporta corchetes [ ]", () => {
    expect(findMatchingBrace("[a, b]", 0, "[", "]")).toBe(5);
  });

  it("devuelve null si no hay cierre", () => {
    expect(findMatchingBrace("{ a: 1", 0)).toBeNull();
  });
});

describe("readLogicalLine", () => {
  it("lee hasta el salto de línea", () => {
    expect(readLogicalLine("id int\nname varchar", 0)).toEqual({
      value: "id int",
      nextIndex: 6,
    });
  });

  it("no corta la línea dentro de corchetes aunque haya salto de línea", () => {
    const text = "id int [\n note: 'x'\n]\nname varchar";
    const result = readLogicalLine(text, 0);
    expect(result.value).toBe("id int [\n note: 'x'\n]");
    expect(text[result.nextIndex]).toBe("\n");
  });

  it("no corta la línea dentro de comillas aunque haya salto de línea", () => {
    const text = "id int [note: 'a\nb']\nname varchar";
    const result = readLogicalLine(text, 0);
    expect(result.value).toContain("a\nb");
  });

  it("llega al final del texto si no hay más saltos de línea", () => {
    expect(readLogicalLine("id int", 0)).toEqual({ value: "id int", nextIndex: 6 });
  });
});
