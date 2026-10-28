import { describe, expect, it } from "vitest";
import { DBML_EXAMPLES } from "../examples";
import { parseDbml } from "../parser/parseDbml";
import type { DbmlSchema } from "../parser/types";
import { serializeDbml, symbolForCardinalities } from "./serializeDbml";

function makeSchema(overrides: Partial<DbmlSchema> = {}): DbmlSchema {
  return { tables: [], refs: [], enums: [], tableGroups: [], warnings: [], ...overrides };
}

describe("symbolForCardinalities", () => {
  it("es la inversa exacta de cardinalitiesForSymbol para los 4 símbolos", () => {
    expect(symbolForCardinalities("many", "one")).toBe(">");
    expect(symbolForCardinalities("one", "many")).toBe("<");
    expect(symbolForCardinalities("one", "one")).toBe("-");
    expect(symbolForCardinalities("many", "many")).toBe("<>");
  });
});

describe("serializeDbml", () => {
  it("devuelve una cadena vacía para un esquema sin tablas, refs ni enums", () => {
    expect(serializeDbml(makeSchema())).toBe("");
  });

  it("serializa una tabla simple con pk, not null, unique, default y note", () => {
    const schema = makeSchema({
      tables: [
        {
          name: "users",
          alias: null,
          note: null,
          headerColor: null,
          columns: [
            {
              name: "id",
              type: "integer",
              isPrimaryKey: true,
              isNotNull: false,
              isUnique: false,
              isIncrement: true,
              isForeignKey: false,
              defaultValue: null,
              note: null,
            },
            {
              name: "email",
              type: "varchar",
              isPrimaryKey: false,
              isNotNull: true,
              isUnique: true,
              isIncrement: false,
              isForeignKey: false,
              defaultValue: null,
              note: "contacto principal",
            },
            {
              name: "role",
              type: "varchar",
              isPrimaryKey: false,
              isNotNull: false,
              isUnique: false,
              isIncrement: false,
              isForeignKey: false,
              defaultValue: "member",
              note: null,
            },
          ],
        },
      ],
    });

    expect(serializeDbml(schema)).toBe(
      `Table users {
  id integer [pk, increment]
  email varchar [not null, unique, note: 'contacto principal']
  role varchar [default: 'member']
}
`,
    );
  });

  it("cita identificadores que no son un identificador simple", () => {
    const schema = makeSchema({
      tables: [
        {
          name: "order items",
          alias: null,
          note: null,
          headerColor: null,
          columns: [
            {
              name: "id",
              type: "integer",
              isPrimaryKey: false,
              isNotNull: false,
              isUnique: false,
              isIncrement: false,
              isForeignKey: false,
              defaultValue: null,
              note: null,
            },
          ],
        },
      ],
    });

    expect(serializeDbml(schema)).toBe(
      `Table "order items" {
  id integer
}
`,
    );
  });

  it("incluye el color de encabezado y la nota de tabla en la línea de declaración", () => {
    const schema = makeSchema({
      tables: [
        {
          name: "users",
          alias: null,
          note: "tabla principal",
          headerColor: "#ff0000",
          columns: [
            {
              name: "id",
              type: "integer",
              isPrimaryKey: false,
              isNotNull: false,
              isUnique: false,
              isIncrement: false,
              isForeignKey: false,
              defaultValue: null,
              note: null,
            },
          ],
        },
      ],
    });

    expect(serializeDbml(schema)).toContain(
      "Table users [headercolor: #ff0000, note: 'tabla principal'] {",
    );
  });

  it("serializa las relaciones usando el símbolo correcto y las agrupa sin líneas en blanco entre ellas", () => {
    const schema = makeSchema({
      refs: [
        {
          left: { table: "posts", column: "user_id", cardinality: "many" },
          right: { table: "users", column: "id", cardinality: "one" },
        },
        {
          left: { table: "profiles", column: "user_id", cardinality: "one" },
          right: { table: "users", column: "id", cardinality: "one" },
        },
      ],
    });

    expect(serializeDbml(schema)).toBe(
      `Ref: posts.user_id > users.id
Ref: profiles.user_id - users.id
`,
    );
  });

  it("serializa los enums con sus valores", () => {
    const schema = makeSchema({
      enums: [{ name: "post_status", values: ["draft", "published"] }],
    });

    expect(serializeDbml(schema)).toBe(
      `Enum post_status {
  draft
  published
}
`,
    );
  });

  it("separa tablas, refs y enums con una línea en blanco entre secciones", () => {
    const schema = makeSchema({
      tables: [
        {
          name: "a",
          alias: null,
          note: null,
          headerColor: null,
          columns: [
            {
              name: "id",
              type: "integer",
              isPrimaryKey: false,
              isNotNull: false,
              isUnique: false,
              isIncrement: false,
              isForeignKey: false,
              defaultValue: null,
              note: null,
            },
          ],
        },
      ],
      enums: [{ name: "e", values: ["x"] }],
    });

    const result = serializeDbml(schema);
    expect(result).toContain("}\n\nEnum e {");
  });

  it("round-trip: parsear, serializar y volver a parsear produce un esquema equivalente", () => {
    for (const example of DBML_EXAMPLES) {
      const firstParse = parseDbml(example.code);
      expect(firstParse.ok).toBe(true);
      if (!firstParse.ok) continue;

      const serialized = serializeDbml(firstParse.schema);
      const secondParse = parseDbml(serialized);
      expect(secondParse.ok).toBe(true);
      if (!secondParse.ok) continue;

      // Mismos nombres de tabla y columnas (el formato puede cambiar, el contenido no).
      expect(secondParse.schema.tables.map((t) => t.name)).toEqual(
        firstParse.schema.tables.map((t) => t.name),
      );
      expect(
        secondParse.schema.tables.map((t) => t.columns.map((c) => c.name)),
      ).toEqual(firstParse.schema.tables.map((t) => t.columns.map((c) => c.name)));
      expect(secondParse.schema.refs).toEqual(firstParse.schema.refs);
      expect(secondParse.schema.enums).toEqual(firstParse.schema.enums);
      expect(secondParse.schema.tableGroups).toEqual(firstParse.schema.tableGroups);
    }
  });

  describe("TableGroup (áreas)", () => {
    it("serializa un área sin color", () => {
      const schema = makeSchema({
        tableGroups: [{ name: "ventas", color: null, tables: ["orders", "customers"] }],
      });
      expect(serializeDbml(schema)).toBe(
        `TableGroup ventas {
  orders
  customers
}
`,
      );
    });

    it("serializa un área con color", () => {
      const schema = makeSchema({
        tableGroups: [{ name: "ventas", color: "#ff0000", tables: ["orders"] }],
      });
      expect(serializeDbml(schema)).toContain("TableGroup ventas [color: #ff0000] {");
    });

    it("cita el nombre del área y de las tablas miembro cuando no son identificadores simples", () => {
      const schema = makeSchema({
        tableGroups: [{ name: "mi área", color: null, tables: ["order items"] }],
      });
      expect(serializeDbml(schema)).toBe(
        `TableGroup "mi área" {
  "order items"
}
`,
      );
    });

    it("round-trip: un área definida a mano sobrevive a parsear → serializar → parsear", () => {
      const original = makeSchema({
        tableGroups: [
          { name: "ventas", color: "#00ff00", tables: ["a", "b"] },
          { name: "soporte", color: null, tables: ["c"] },
        ],
      });
      const reparsed = parseDbml(serializeDbml(original));
      expect(reparsed.ok).toBe(true);
      if (reparsed.ok) {
        expect(reparsed.schema.tableGroups).toEqual(original.tableGroups);
      }
    });
  });
});
