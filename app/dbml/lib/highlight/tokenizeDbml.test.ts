import { describe, expect, it } from "vitest";
import { tokenizeDbml } from "./tokenizeDbml";

function typesOf(source: string): string[] {
  return tokenizeDbml(source).map((token) => token.type);
}

function joinText(source: string): string {
  return tokenizeDbml(source)
    .map((token) => token.text)
    .join("");
}

describe("tokenizeDbml", () => {
  it("reconstruye exactamente el texto original al unir los tokens", () => {
    const source = `Table users {\n  id integer [pk, not null] // comentario\n}`;
    expect(joinText(source)).toBe(source);
  });

  it("reconoce las palabras clave de bloque", () => {
    expect(typesOf("Table")).toEqual(["keyword"]);
    expect(typesOf("Enum")).toEqual(["keyword"]);
    expect(typesOf("TableGroup")).toEqual(["keyword"]);
    expect(typesOf("Ref")).toEqual(["keyword"]);
  });

  it("no colorea una palabra clave que es solo prefijo de un identificador", () => {
    expect(typesOf("Tablero")).toEqual(["plain"]);
  });

  it("reconoce comentarios de línea y de bloque", () => {
    expect(typesOf("// nota")).toEqual(["comment"]);
    expect(typesOf("/* nota\nmultilinea */")).toEqual(["comment"]);
  });

  it("no colorea una palabra clave dentro de un comentario", () => {
    const tokens = tokenizeDbml("// Table users");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("comment");
  });

  it("reconoce cadenas simples, dobles y con backticks", () => {
    expect(typesOf("'hola'")).toEqual(["string"]);
    expect(typesOf('"hola"')).toEqual(["string"]);
    expect(typesOf("`now()`")).toEqual(["string"]);
  });

  it("no colorea una palabra clave dentro de una cadena", () => {
    const tokens = tokenizeDbml("'Table'");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("string");
  });

  it("reconoce ajustes de columna como 'attribute'", () => {
    expect(typesOf("pk")).toEqual(["attribute"]);
    expect(typesOf("not null")).toEqual(["attribute"]);
    expect(typesOf("unique")).toEqual(["attribute"]);
  });

  it("reconoce números", () => {
    expect(typesOf("42")).toEqual(["number"]);
    expect(typesOf("3.14")).toEqual(["number"]);
  });

  it("reconoce puntuación", () => {
    expect(typesOf("{")).toEqual(["punctuation"]);
    expect(typesOf("[")).toEqual(["punctuation"]);
  });

  it("deja un identificador cualquiera como texto plano", () => {
    expect(typesOf("username")).toEqual(["plain"]);
  });

  it("reconoce tipos de dato comunes", () => {
    expect(typesOf("varchar")).toEqual(["type"]);
    expect(typesOf("integer")).toEqual(["type"]);
    expect(typesOf("timestamp")).toEqual(["type"]);
  });

  it("colorea el nombre de una tabla después de Table/Enum/TableGroup", () => {
    const [, name] = tokenizeDbml("Table users {").filter((t) => t.text.trim() !== "");
    expect(name.text).toBe("users");
    expect(name.type).toBe("name");
  });

  it("colorea un nombre de tabla citado entre comillas", () => {
    const significant = tokenizeDbml('Table "order items" {').filter((t) => t.text.trim() !== "");
    const name = significant[1];
    expect(name.text).toBe('"order items"');
    expect(name.type).toBe("name");
  });

  it("colorea el alias después de 'as' como nombre", () => {
    const significant = tokenizeDbml("Table users as u {").filter((t) => t.text.trim() !== "");
    const alias = significant[significant.length - 2];
    expect(alias.text).toBe("u");
    expect(alias.type).toBe("name");
  });

  it("colorea como nombre un identificador seguido de un punto (referencia a tabla)", () => {
    const significant = tokenizeDbml("posts.user_id").filter((t) => t.text.trim() !== "");
    expect(significant[0]).toEqual({ type: "name", text: "posts" });
    expect(significant[2]).toEqual({ type: "plain", text: "user_id" });
  });

  it("tokeniza una tabla completa con una mezcla razonable de tipos", () => {
    const source = "Table users {\n  id integer [pk]\n}";
    const types = typesOf(source);
    expect(types).toContain("keyword");
    expect(types).toContain("name");
    expect(types).toContain("type");
    expect(types).toContain("punctuation");
    expect(types).toContain("attribute");
    expect(types).toContain("plain");
  });
});
