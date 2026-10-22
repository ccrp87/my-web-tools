import { describe, expect, it } from "vitest";
import { buildDiagramFileName } from "./download";

describe("buildDiagramFileName", () => {
  it("construye el nombre con extensión svg", () => {
    expect(buildDiagramFileName("svg")).toBe("diagrama-mermaid.svg");
  });

  it("construye el nombre con extensión png", () => {
    expect(buildDiagramFileName("png")).toBe("diagrama-mermaid.png");
  });
});
