import { describe, expect, it } from "vitest";
import {
  extractFlowchartNodeId,
  replaceFlowchartNodeLabel,
  upsertFlowchartNodeStyle,
} from "./flowchartNodes";

describe("extractFlowchartNodeId", () => {
  it("recupera el id del nodo a partir del id completo del grupo SVG", () => {
    expect(extractFlowchartNodeId("R2l5esnflb-4-flowchart-A-0", "R2l5esnflb-4")).toBe(
      "A",
    );
  });

  it("funciona con ids de nodo con números y guiones bajos", () => {
    expect(
      extractFlowchartNodeId("abc-1-flowchart-node_2-10", "abc-1"),
    ).toBe("node_2");
  });

  it("devuelve null si el id no empieza con el renderId dado", () => {
    expect(extractFlowchartNodeId("otro-flowchart-A-0", "abc-1")).toBeNull();
  });

  it("devuelve null si el sufijo no tiene el formato esperado", () => {
    expect(extractFlowchartNodeId("abc-1-algo-raro", "abc-1")).toBeNull();
  });
});

describe("replaceFlowchartNodeLabel", () => {
  it("reemplaza una etiqueta entre corchetes", () => {
    const code = "flowchart TD\n    A[Inicio] --> B[Fin]";
    expect(replaceFlowchartNodeLabel(code, "A", "Comienzo")).toBe(
      "flowchart TD\n    A[Comienzo] --> B[Fin]",
    );
  });

  it("reemplaza una etiqueta entre paréntesis (redondeada)", () => {
    const code = "flowchart TD\n    A(Inicio) --> B(Fin)";
    expect(replaceFlowchartNodeLabel(code, "B", "Terminado")).toBe(
      "flowchart TD\n    A(Inicio) --> B(Terminado)",
    );
  });

  it("reemplaza una etiqueta de rombo sin afectar el hexágono de otro nodo", () => {
    const code = "flowchart TD\n    A{¿Datos?} --> B{{Hex}}";
    expect(replaceFlowchartNodeLabel(code, "A", "¿Listo?")).toBe(
      "flowchart TD\n    A{¿Listo?} --> B{{Hex}}",
    );
  });

  it("reemplaza una etiqueta de hexágono sin que la capture el rombo", () => {
    const code = "flowchart TD\n    A{¿Datos?} --> B{{Hex}}";
    expect(replaceFlowchartNodeLabel(code, "B", "Hexagonal")).toBe(
      "flowchart TD\n    A{¿Datos?} --> B{{Hexagonal}}",
    );
  });

  it("no confunde un id que es prefijo de otro (A vs AB)", () => {
    const code = "flowchart TD\n    AB[Nodo largo] --> A[Nodo corto]";
    expect(replaceFlowchartNodeLabel(code, "A", "Cambiado")).toBe(
      "flowchart TD\n    AB[Nodo largo] --> A[Cambiado]",
    );
  });

  it("devuelve null si no encuentra una forma reconocible para el id", () => {
    const code = "flowchart TD\n    A --> B[Fin]";
    expect(replaceFlowchartNodeLabel(code, "A", "Nuevo")).toBeNull();
  });
});

describe("upsertFlowchartNodeStyle", () => {
  it("agrega una línea style nueva si el nodo no tenía una", () => {
    const code = "flowchart TD\n    A[Inicio] --> B[Fin]";
    expect(upsertFlowchartNodeStyle(code, "A", "#ff0000")).toBe(
      "flowchart TD\n    A[Inicio] --> B[Fin]\nstyle A fill:#ff0000\n",
    );
  });

  it("actualiza el fill en una línea style existente, conservando otras propiedades", () => {
    const code = "flowchart TD\n    A[Inicio]\n    style A fill:#000000,stroke:#333";
    expect(upsertFlowchartNodeStyle(code, "A", "#ff0000")).toBe(
      "flowchart TD\n    A[Inicio]\n    style A fill:#ff0000,stroke:#333",
    );
  });

  it("agrega fill a una línea style que no lo tenía", () => {
    const code = "flowchart TD\n    A[Inicio]\n    style A stroke:#333";
    expect(upsertFlowchartNodeStyle(code, "A", "#ff0000")).toBe(
      "flowchart TD\n    A[Inicio]\n    style A stroke:#333,fill:#ff0000",
    );
  });
});
