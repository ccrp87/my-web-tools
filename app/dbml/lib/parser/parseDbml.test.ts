import { describe, expect, it } from "vitest";
import { parseDbml } from "./parseDbml";
import type { DbmlSchema } from "./types";

function expectOk(source: string): DbmlSchema {
  const result = parseDbml(source);
  if (!result.ok) {
    throw new Error(`Se esperaba un parseo exitoso pero falló: ${result.error.message}`);
  }
  return result.schema;
}

describe("parseDbml - esquema básico", () => {
  it("parsea una tabla simple con columnas y tipos", () => {
    const schema = expectOk(`
      Table users {
        id integer [pk, increment]
        username varchar(255) [not null, unique]
        role varchar [default: 'member']
        created_at timestamp
      }
    `);

    expect(schema.tables).toHaveLength(1);
    const [users] = schema.tables;
    expect(users.name).toBe("users");
    expect(users.columns).toHaveLength(4);
    expect(users.columns[0]).toMatchObject({
      name: "id",
      type: "integer",
      isPrimaryKey: true,
      isIncrement: true,
    });
    expect(users.columns[1]).toMatchObject({
      name: "username",
      type: "varchar(255)",
      isNotNull: true,
      isUnique: true,
    });
    expect(users.columns[2].defaultValue).toBe("member");
  });

  it("soporta alias de tabla con 'as'", () => {
    const schema = expectOk(`
      Table users as u {
        id integer [pk]
      }
    `);
    expect(schema.tables[0].alias).toBe("u");
  });

  it("soporta headercolor y note a nivel de tabla", () => {
    const schema = expectOk(`
      Table users [headercolor: #3b82f6, note: 'tabla de usuarios'] {
        id integer [pk]
      }
    `);
    expect(schema.tables[0].headerColor).toBe("#3b82f6");
    expect(schema.tables[0].note).toBe("tabla de usuarios");
  });

  it("soporta Note dentro del cuerpo de la tabla en forma corta y de bloque", () => {
    const corta = expectOk(`
      Table a {
        id integer
        Note: 'nota corta'
      }
    `);
    expect(corta.tables[0].note).toBe("nota corta");

    const bloque = expectOk(`
      Table a {
        id integer
        Note {
          'nota en bloque'
        }
      }
    `);
    expect(bloque.tables[0].note).toBe("nota en bloque");
  });

  it("ignora un bloque Indexes dentro de la tabla sin romper el parseo", () => {
    const schema = expectOk(`
      Table posts {
        id integer [pk]
        user_id integer
        title varchar
        Indexes {
          (user_id, title) [unique]
          title
        }
      }
    `);
    expect(schema.tables[0].columns.map((c) => c.name)).toEqual(["id", "user_id", "title"]);
  });

  it("toma solo el último segmento de una tabla calificada por esquema", () => {
    const schema = expectOk(`
      Table public.users {
        id integer [pk]
      }
    `);
    expect(schema.tables[0].name).toBe("users");
  });

  it("soporta nombres de tabla y columna entre comillas", () => {
    const schema = expectOk(`
      Table "user accounts" {
        "full name" varchar
      }
    `);
    expect(schema.tables[0].name).toBe("user accounts");
    expect(schema.tables[0].columns[0].name).toBe("full name");
  });
});

describe("parseDbml - comentarios", () => {
  it("ignora comentarios de línea y de bloque sin afectar el resultado", () => {
    const schema = expectOk(`
      // tabla principal
      Table users {
        id integer [pk] // llave primaria
        /* este campo
           guarda el nombre */
        name varchar
      }
    `);
    expect(schema.tables[0].columns.map((c) => c.name)).toEqual(["id", "name"]);
  });
});

describe("parseDbml - relaciones (Ref)", () => {
  it("parsea una relación en forma corta y marca isForeignKey", () => {
    const schema = expectOk(`
      Table users {
        id integer [pk]
      }
      Table posts {
        id integer [pk]
        user_id integer
      }
      Ref: posts.user_id > users.id
    `);

    expect(schema.refs).toHaveLength(1);
    expect(schema.refs[0]).toEqual({
      left: { table: "posts", column: "user_id", cardinality: "many" },
      right: { table: "users", column: "id", cardinality: "one" },
    });

    const posts = schema.tables.find((t) => t.name === "posts")!;
    expect(posts.columns.find((c) => c.name === "user_id")?.isForeignKey).toBe(true);
    const users = schema.tables.find((t) => t.name === "users")!;
    expect(users.columns.find((c) => c.name === "id")?.isForeignKey).toBe(true);
  });

  it("parsea una relación en forma de bloque con nombre", () => {
    const schema = expectOk(`
      Table a { id integer [pk] }
      Table b { a_id integer }
      Ref posts_users {
        b.a_id > a.id
      }
    `);
    expect(schema.refs).toHaveLength(1);
  });

  it.each([
    ["<", "one", "many"],
    [">", "many", "one"],
    ["-", "one", "one"],
    ["<>", "many", "many"],
  ])("interpreta el símbolo %s como %s/%s", (symbol, leftCardinality, rightCardinality) => {
    const schema = expectOk(`
      Table a { id integer [pk] }
      Table b { a_id integer }
      Ref: b.a_id ${symbol} a.id
    `);
    expect(schema.refs[0].left.cardinality).toBe(leftCardinality);
    expect(schema.refs[0].right.cardinality).toBe(rightCardinality);
  });

  it("agrega una relación inline declarada en una columna vía ref:", () => {
    const schema = expectOk(`
      Table users {
        id integer [pk]
      }
      Table posts {
        id integer [pk]
        user_id integer [ref: > users.id]
      }
    `);
    expect(schema.refs).toHaveLength(1);
    expect(schema.refs[0]).toEqual({
      left: { table: "posts", column: "user_id", cardinality: "many" },
      right: { table: "users", column: "id", cardinality: "one" },
    });
  });

  it("descarta relaciones con columnas compuestas y agrega un warning", () => {
    const schema = expectOk(`
      Table a { id integer }
      Table b { id integer }
      Ref: a.(id) > b.(id)
    `);
    expect(schema.refs).toHaveLength(0);
    expect(schema.warnings).toContain(
      "Se ignoró una relación con columnas compuestas (no soportado).",
    );
  });

  it("descarta relaciones a tabla/columna inexistente y avisa cuántas", () => {
    const schema = expectOk(`
      Table a { id integer [pk] }
      Ref: a.id > inexistente.id
      Ref: a.columna_inexistente > a.id
    `);
    expect(schema.refs).toHaveLength(0);
    expect(schema.warnings).toContain(
      "Se ignoraron 2 relación(es) que apuntan a una tabla o columna inexistente.",
    );
  });
});

describe("parseDbml - enums", () => {
  it("parsea un enum con varios valores", () => {
    const schema = expectOk(`
      Enum post_status {
        draft
        published
        archived
      }
    `);
    expect(schema.enums).toEqual([
      { name: "post_status", values: ["draft", "published", "archived"] },
    ]);
  });

  it("ignora settings de cada valor del enum", () => {
    const schema = expectOk(`
      Enum post_status {
        draft [note: 'borrador']
        published
      }
    `);
    expect(schema.enums[0].values).toEqual(["draft", "published"]);
  });
});

describe("parseDbml - bloques no soportados", () => {
  it("ignora Project/Note a nivel raíz con un warning, sin romper el resto", () => {
    const schema = expectOk(`
      Project mi_proyecto {
        database_type: 'PostgreSQL'
      }
      Table a { id integer [pk] }
    `);
    expect(schema.tables).toHaveLength(1);
    expect(schema.warnings).toContain('Se ignoró un bloque "Project" (no soportado).');
  });
});

describe("parseDbml - TableGroup (áreas)", () => {
  it("parsea un área simple sin color", () => {
    const schema = expectOk(`
      Table a { id integer [pk] }
      Table b { id integer [pk] }
      TableGroup ventas {
        a
        b
      }
    `);
    expect(schema.tableGroups).toEqual([{ name: "ventas", color: null, tables: ["a", "b"] }]);
  });

  it("parsea el color del área", () => {
    const schema = expectOk(`
      TableGroup ventas [color: #ff0000] {
        a
      }
    `);
    expect(schema.tableGroups[0].color).toBe("#ff0000");
  });

  it("acepta un nombre de área con espacios entre comillas", () => {
    const schema = expectOk(`
      TableGroup "mi área" {
        a
      }
    `);
    expect(schema.tableGroups[0].name).toBe("mi área");
  });

  it("acepta varias tablas y varios grupos", () => {
    const schema = expectOk(`
      TableGroup uno {
        a
        b
      }
      TableGroup dos {
        c
      }
    `);
    expect(schema.tableGroups).toHaveLength(2);
    expect(schema.tableGroups[0].tables).toEqual(["a", "b"]);
    expect(schema.tableGroups[1].tables).toEqual(["c"]);
  });

  it("no valida que las tablas miembro existan realmente", () => {
    const schema = expectOk(`
      TableGroup ventas {
        tabla_que_no_existe
      }
    `);
    expect(schema.tableGroups[0].tables).toEqual(["tabla_que_no_existe"]);
    expect(schema.warnings).toEqual([]);
  });

  it("ignora un área duplicada y avisa", () => {
    const schema = expectOk(`
      TableGroup ventas { a }
      TableGroup ventas { b }
    `);
    expect(schema.tableGroups).toHaveLength(1);
    expect(schema.tableGroups[0].tables).toEqual(["a"]);
    expect(schema.warnings).toContain('Se ignoró un área duplicada: "ventas".');
  });

  it("reporta un error de sintaxis si falta \"{\"", () => {
    const result = parseDbml(`
      TableGroup ventas
        a
      }
    `);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('"{"');
      expect(result.error.line).toBe(3);
    }
  });

  it("reporta un error de sintaxis si falta \"}\"", () => {
    const result = parseDbml(`TableGroup ventas {
      a`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('"}"');
      expect(result.error.line).toBe(1);
    }
  });
});

describe("parseDbml - tablas duplicadas", () => {
  it("ignora la segunda declaración de una tabla duplicada y avisa", () => {
    const schema = expectOk(`
      Table users { id integer [pk] }
      Table users { otra_columna varchar }
    `);
    expect(schema.tables).toHaveLength(1);
    expect(schema.tables[0].columns[0].name).toBe("id");
    expect(schema.warnings).toContain('Se ignoró una tabla duplicada: "users".');
  });
});

describe("parseDbml - esquema realista de blog", () => {
  const BLOG_SCHEMA = `
    // Esquema de ejemplo para un blog
    Enum post_status {
      draft
      published
      archived
    }

    Table users {
      id integer [pk, increment]
      username varchar [not null, unique]
      role varchar [default: 'member']
    }

    Table posts {
      id integer [pk, increment]
      user_id integer [ref: > users.id]
      title varchar [not null]
      status post_status
      /* fecha de publicación */
      published_at timestamp

      Indexes {
        (user_id, title) [unique]
      }
    }

    Table comments {
      id integer [pk, increment]
      post_id integer
      author_id integer
      body varchar
    }

    Ref: comments.post_id > posts.id
    Ref: comments.author_id > users.id
  `;

  it("parsea el esquema completo sin errores", () => {
    const schema = expectOk(BLOG_SCHEMA);
    expect(schema.tables.map((t) => t.name)).toEqual(["users", "posts", "comments"]);
    expect(schema.enums).toHaveLength(1);
    expect(schema.refs).toHaveLength(3); // 1 inline (posts.user_id) + 2 explícitas
  });

  it("marca correctamente isForeignKey en todas las columnas involucradas", () => {
    const schema = expectOk(BLOG_SCHEMA);
    const posts = schema.tables.find((t) => t.name === "posts")!;
    const comments = schema.tables.find((t) => t.name === "comments")!;
    const users = schema.tables.find((t) => t.name === "users")!;

    expect(posts.columns.find((c) => c.name === "user_id")?.isForeignKey).toBe(true);
    expect(comments.columns.find((c) => c.name === "post_id")?.isForeignKey).toBe(true);
    expect(comments.columns.find((c) => c.name === "author_id")?.isForeignKey).toBe(true);
    expect(users.columns.find((c) => c.name === "id")?.isForeignKey).toBe(true);
    expect(posts.columns.find((c) => c.name === "title")?.isForeignKey).toBe(false);
  });
});

describe("parseDbml - errores de sintaxis", () => {
  it("reporta una tabla sin cerrar con el número de línea aproximado", () => {
    const result = parseDbml("Table a {\n  id integer\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("tabla");
      expect(result.error.message).toContain("a");
    }
  });

  it("reporta un token inesperado donde se esperaba un nombre de tabla", () => {
    const result = parseDbml("Table { id integer }");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("nombre de tabla");
      expect(result.error.line).toBe(1);
    }
  });

  it("reporta el número de línea correcto para un error más adelante en el archivo", () => {
    const result = parseDbml("Table a {\n  id integer\n}\n\nTable {\n  x int\n}");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBe(5);
    }
  });

  it("reporta un enum sin nombre", () => {
    const result = parseDbml("Enum { a b }");
    expect(result.ok).toBe(false);
  });

  it("reporta una relación ilegible", () => {
    const result = parseDbml("Ref: esto no es una relación valida");
    expect(result.ok).toBe(false);
  });
});

describe("parseDbml - casos límite", () => {
  it("devuelve un esquema vacío para una entrada vacía", () => {
    const schema = expectOk("");
    expect(schema).toEqual({ tables: [], refs: [], enums: [], tableGroups: [], warnings: [] });
  });

  it("devuelve un esquema vacío para una entrada solo con espacios", () => {
    const schema = expectOk("   \n\n  ");
    expect(schema.tables).toEqual([]);
  });
});
