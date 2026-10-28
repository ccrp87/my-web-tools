import { describe, expect, it } from "vitest";
import type { DbmlColumn, DbmlSchema, DbmlTable } from "../parser/types";
import { generateSql } from "./generateSql";

function makeColumn(overrides: Partial<DbmlColumn> = {}): DbmlColumn {
  return {
    name: "id",
    type: "integer",
    isPrimaryKey: false,
    isNotNull: false,
    isUnique: false,
    isIncrement: false,
    isForeignKey: false,
    defaultValue: null,
    note: null,
    ...overrides,
  };
}

function makeTable(overrides: Partial<DbmlTable> = {}): DbmlTable {
  return {
    name: "users",
    alias: null,
    note: null,
    headerColor: null,
    columns: [makeColumn()],
    ...overrides,
  };
}

function makeSchema(overrides: Partial<DbmlSchema> = {}): DbmlSchema {
  return { tables: [], refs: [], enums: [], tableGroups: [], warnings: [], ...overrides };
}

describe("generateSql", () => {
  it("genera una tabla simple con pk e increment (postgres usa SERIAL)", () => {
    const schema = makeSchema({
      tables: [makeTable({ columns: [makeColumn({ isPrimaryKey: true, isIncrement: true })] })],
    });
    expect(generateSql(schema, "postgres")).toBe("CREATE TABLE users (\n  id SERIAL PRIMARY KEY\n);\n");
  });

  it("mysql usa AUTO_INCREMENT en vez de cambiar el tipo", () => {
    const schema = makeSchema({
      tables: [makeTable({ columns: [makeColumn({ isPrimaryKey: true, isIncrement: true })] })],
    });
    expect(generateSql(schema, "mysql")).toBe(
      "CREATE TABLE users (\n  id integer AUTO_INCREMENT PRIMARY KEY\n);\n",
    );
  });

  it("sqlserver usa IDENTITY(1,1)", () => {
    const schema = makeSchema({
      tables: [makeTable({ columns: [makeColumn({ isPrimaryKey: true, isIncrement: true })] })],
    });
    expect(generateSql(schema, "sqlserver")).toBe(
      "CREATE TABLE users (\n  id integer IDENTITY(1,1) PRIMARY KEY\n);\n",
    );
  });

  it("postgres usa BIGSERIAL para bigint con increment", () => {
    const schema = makeSchema({
      tables: [
        makeTable({ columns: [makeColumn({ type: "bigint", isPrimaryKey: true, isIncrement: true })] }),
      ],
    });
    expect(generateSql(schema, "postgres")).toContain("id BIGSERIAL PRIMARY KEY");
  });

  it("not null y unique se omiten si la columna ya es primary key", () => {
    const schema = makeSchema({
      tables: [
        makeTable({
          columns: [makeColumn({ isPrimaryKey: true, isNotNull: true, isUnique: true })],
        }),
      ],
    });
    const sql = generateSql(schema, "postgres");
    expect(sql).toContain("id integer PRIMARY KEY");
    expect(sql).not.toContain("NOT NULL");
    expect(sql).not.toContain("UNIQUE");
  });

  it("not null y unique se incluyen cuando no es primary key", () => {
    const schema = makeSchema({
      tables: [makeTable({ columns: [makeColumn({ isNotNull: true, isUnique: true })] })],
    });
    expect(generateSql(schema, "postgres")).toContain("id integer NOT NULL UNIQUE");
  });

  it("default numérico va sin comillas", () => {
    const schema = makeSchema({
      tables: [makeTable({ columns: [makeColumn({ defaultValue: "42" })] })],
    });
    expect(generateSql(schema, "postgres")).toContain("DEFAULT 42");
  });

  it("default de texto con comilla interna se escapa duplicándola", () => {
    const schema = makeSchema({
      tables: [makeTable({ columns: [makeColumn({ defaultValue: "it's fine" })] })],
    });
    expect(generateSql(schema, "postgres")).toContain("DEFAULT 'it''s fine'");
  });

  it("default tipo expresión (entre backticks) va sin comillas adicionales", () => {
    const schema = makeSchema({
      tables: [makeTable({ columns: [makeColumn({ defaultValue: "`now()`" })] })],
    });
    expect(generateSql(schema, "postgres")).toContain("DEFAULT now()");
  });

  it("un identificador con espacio se cita según el dialecto", () => {
    const schema = makeSchema({ tables: [makeTable({ name: "order items" })] });
    expect(generateSql(schema, "postgres")).toContain('CREATE TABLE "order items"');
    expect(generateSql(schema, "sqlserver")).toContain('CREATE TABLE "order items"');
    expect(generateSql(schema, "mysql")).toContain("CREATE TABLE `order items`");
  });

  describe("enums", () => {
    it("postgres: CREATE TYPE y la columna conserva el nombre del enum", () => {
      const schema = makeSchema({
        tables: [makeTable({ columns: [makeColumn({ type: "status" })] })],
        enums: [{ name: "status", values: ["draft", "published"] }],
      });
      const sql = generateSql(schema, "postgres");
      expect(sql).toContain("CREATE TYPE status AS ENUM ('draft', 'published');");
      expect(sql).toContain("id status");
    });

    it("mysql: la columna se expande a ENUM(...) inline", () => {
      const schema = makeSchema({
        tables: [makeTable({ columns: [makeColumn({ type: "status" })] })],
        enums: [{ name: "status", values: ["draft", "published"] }],
      });
      expect(generateSql(schema, "mysql")).toContain("id ENUM('draft', 'published')");
    });

    it("sqlserver: NVARCHAR(255) con un CHECK listando los valores", () => {
      const schema = makeSchema({
        tables: [makeTable({ columns: [makeColumn({ type: "status" })] })],
        enums: [{ name: "status", values: ["draft", "published"] }],
      });
      const sql = generateSql(schema, "sqlserver");
      expect(sql).toContain("id NVARCHAR(255)");
      expect(sql).toContain("CHECK (id IN ('draft', 'published'))");
    });
  });

  describe("relaciones", () => {
    it("uno-a-muchos: la FK va en la tabla del lado 'muchos'", () => {
      const schema = makeSchema({
        tables: [makeTable({ name: "users" }), makeTable({ name: "posts" })],
        refs: [
          {
            left: { table: "posts", column: "user_id", cardinality: "many" },
            right: { table: "users", column: "id", cardinality: "one" },
          },
        ],
      });
      const sql = generateSql(schema, "postgres");
      expect(sql).toContain(
        "ALTER TABLE posts ADD CONSTRAINT fk_posts_user_id FOREIGN KEY (user_id) REFERENCES users (id);",
      );
    });

    it("uno-a-uno: la FK va del lado izquierdo hacia el derecho", () => {
      const schema = makeSchema({
        tables: [makeTable({ name: "users" }), makeTable({ name: "profiles" })],
        refs: [
          {
            left: { table: "profiles", column: "user_id", cardinality: "one" },
            right: { table: "users", column: "id", cardinality: "one" },
          },
        ],
      });
      const sql = generateSql(schema, "postgres");
      expect(sql).toContain(
        "ALTER TABLE profiles ADD CONSTRAINT fk_profiles_user_id FOREIGN KEY (user_id) REFERENCES users (id);",
      );
    });

    it("muchos-a-muchos: solo un comentario, sin FK", () => {
      const schema = makeSchema({
        tables: [makeTable({ name: "students" }), makeTable({ name: "courses" })],
        refs: [
          {
            left: { table: "students", column: "id", cardinality: "many" },
            right: { table: "courses", column: "id", cardinality: "many" },
          },
        ],
      });
      const sql = generateSql(schema, "postgres");
      expect(sql).toContain("-- Relación muchos-a-muchos entre students.id y courses.id");
      expect(sql).not.toContain("ALTER TABLE");
    });
  });

  it("devuelve una cadena vacía para un esquema vacío", () => {
    expect(generateSql(makeSchema(), "postgres")).toBe("");
  });
});
