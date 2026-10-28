import { describe, expect, it } from "vitest";
import { sortByUpdatedAtDesc } from "./library";
import type { SavedDiagram } from "./library";

function makeDiagram(overrides: Partial<SavedDiagram> = {}): SavedDiagram {
  return { id: "a", name: "a", code: "", updatedAt: 0, ...overrides };
}

describe("sortByUpdatedAtDesc", () => {
  it("ordena del más reciente al más antiguo", () => {
    const diagrams = [
      makeDiagram({ id: "old", updatedAt: 1 }),
      makeDiagram({ id: "new", updatedAt: 3 }),
      makeDiagram({ id: "mid", updatedAt: 2 }),
    ];
    expect(sortByUpdatedAtDesc(diagrams).map((d) => d.id)).toEqual(["new", "mid", "old"]);
  });

  it("no muta el arreglo original", () => {
    const diagrams = [makeDiagram({ id: "a", updatedAt: 1 }), makeDiagram({ id: "b", updatedAt: 2 })];
    const original = [...diagrams];
    sortByUpdatedAtDesc(diagrams);
    expect(diagrams).toEqual(original);
  });
});
