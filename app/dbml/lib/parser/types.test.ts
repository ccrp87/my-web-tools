import { describe, expect, it } from "vitest";
import { cardinalitiesForSymbol } from "./types";

describe("cardinalitiesForSymbol", () => {
  it("'>' es muchos-a-uno: izquierda muchos, derecha uno", () => {
    // Ref: posts.user_id > users.id  =>  muchos posts por un user
    expect(cardinalitiesForSymbol(">")).toEqual(["many", "one"]);
  });

  it("'<' es uno-a-muchos: izquierda uno, derecha muchos", () => {
    expect(cardinalitiesForSymbol("<")).toEqual(["one", "many"]);
  });

  it("'-' es uno-a-uno en ambos extremos", () => {
    expect(cardinalitiesForSymbol("-")).toEqual(["one", "one"]);
  });

  it("'<>' es muchos-a-muchos en ambos extremos", () => {
    expect(cardinalitiesForSymbol("<>")).toEqual(["many", "many"]);
  });
});
