import { describe, expect, it } from "vitest";
import { buildDiagramFileName, buildSqlFileName } from "./download";

describe("buildDiagramFileName", () => {
  it("construye el nombre con extensión svg", () => {
    expect(buildDiagramFileName("svg")).toBe("diagrama-dbml.svg");
  });

  it("construye el nombre con extensión png", () => {
    expect(buildDiagramFileName("png")).toBe("diagrama-dbml.png");
  });

  it("construye el nombre con extensión dbml", () => {
    expect(buildDiagramFileName("dbml")).toBe("diagrama-dbml.dbml");
  });
});

describe("buildSqlFileName", () => {
  it("distingue el dialecto en el nombre de archivo", () => {
    expect(buildSqlFileName("postgres")).toBe("diagrama-dbml-postgres.sql");
    expect(buildSqlFileName("mysql")).toBe("diagrama-dbml-mysql.sql");
    expect(buildSqlFileName("sqlserver")).toBe("diagrama-dbml-sqlserver.sql");
  });
});
