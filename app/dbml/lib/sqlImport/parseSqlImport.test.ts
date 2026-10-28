import { describe, expect, it } from "vitest";
import { parseSqlImport } from "./parseSqlImport";
import type { DbmlSchema } from "../parser/types";

function okSchema(sql: string, dialect: Parameters<typeof parseSqlImport>[1]): DbmlSchema {
  const result = parseSqlImport(sql, dialect);
  if (!result.ok) throw new Error(`Se esperaba éxito, falló con: ${result.error}`);
  return result.schema;
}

describe("parseSqlImport", () => {
  it("falla si no hay ninguna sentencia", () => {
    expect(parseSqlImport("", "postgres")).toEqual({
      ok: false,
      error: "No se encontró ninguna sentencia SQL para importar.",
    });
  });

  it("falla si no hay ningún CREATE TABLE", () => {
    const result = parseSqlImport("CREATE INDEX idx_x ON users (email);", "postgres");
    expect(result).toEqual({
      ok: false,
      error: "No se encontraron tablas (CREATE TABLE) para importar en este SQL.",
    });
  });

  it("importa una tabla Postgres con SERIAL, NOT NULL, UNIQUE y DEFAULT de expresión", () => {
    const schema = okSchema(
      `CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(20) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT now()
      );`,
      "postgres",
    );

    expect(schema.tables).toHaveLength(1);
    const [table] = schema.tables;
    expect(table.name).toBe("users");

    const id = table.columns.find((c) => c.name === "id")!;
    expect(id.isPrimaryKey).toBe(true);
    expect(id.isIncrement).toBe(true);
    expect(id.isNotNull).toBe(true);
    expect(id.type).toBe("integer");

    const email = table.columns.find((c) => c.name === "email")!;
    expect(email.isNotNull).toBe(true);
    expect(email.isUnique).toBe(true);

    const role = table.columns.find((c) => c.name === "role")!;
    expect(role.defaultValue).toBe("member");

    const createdAt = table.columns.find((c) => c.name === "created_at")!;
    expect(createdAt.defaultValue).toBe("`now()`");
  });

  it("importa claves foráneas inline y de nivel tabla en Postgres", () => {
    const schema = okSchema(
      `CREATE TABLE users (
        id SERIAL PRIMARY KEY
      );
      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );`,
      "postgres",
    );

    const posts = schema.tables.find((t) => t.name === "posts")!;
    expect(posts.columns.find((c) => c.name === "user_id")!.isForeignKey).toBe(true);
    expect(schema.refs).toHaveLength(2);
    expect(schema.refs[0]).toEqual({
      left: { table: "posts", column: "user_id", cardinality: "many" },
      right: { table: "users", column: "id", cardinality: "one" },
    });
  });

  it("interpreta CREATE TYPE ... AS ENUM de Postgres como Enum referenciado", () => {
    const schema = okSchema(
      `CREATE TYPE user_role AS ENUM ('member', 'admin');
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        role user_role NOT NULL
      );`,
      "postgres",
    );

    expect(schema.enums).toEqual([{ name: "user_role", values: ["member", "admin"] }]);
    expect(schema.tables[0].columns.find((c) => c.name === "role")!.type).toBe("user_role");
  });

  it("importa MySQL con backticks, AUTO_INCREMENT, ENUM inline y COMMENT", () => {
    const schema = okSchema(
      "CREATE TABLE `posts` (\n" +
        "  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,\n" +
        "  `status` ENUM('draft', 'published') NOT NULL COMMENT 'estado del post',\n" +
        "  `user_id` INT NOT NULL,\n" +
        "  CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)\n" +
        ");",
      "mysql",
    );

    const posts = schema.tables[0];
    expect(posts.name).toBe("posts");

    const id = posts.columns.find((c) => c.name === "id")!;
    expect(id.isIncrement).toBe(true);
    expect(id.isPrimaryKey).toBe(true);

    const status = posts.columns.find((c) => c.name === "status")!;
    expect(status.note).toBe("estado del post");
    expect(status.type).toBe("posts_status");
    expect(schema.enums).toEqual([{ name: "posts_status", values: ["draft", "published"] }]);

    expect(posts.columns.find((c) => c.name === "user_id")!.isForeignKey).toBe(true);
  });

  it("importa MariaDB igual que MySQL (mismo dialecto de sintaxis)", () => {
    const schema = okSchema(
      "CREATE TABLE `tags` (\n  `id` INT AUTO_INCREMENT PRIMARY KEY,\n  `name` VARCHAR(50) NOT NULL\n);",
      "mariadb",
    );
    expect(schema.tables[0].columns.find((c) => c.name === "id")!.isIncrement).toBe(true);
  });

  it("importa SQL Server con corchetes, IDENTITY y CHECK emulando un enum", () => {
    const schema = okSchema(
      "CREATE TABLE [orders] (\n" +
        "  [id] INT IDENTITY(1,1) PRIMARY KEY,\n" +
        "  [status] NVARCHAR(20) NOT NULL CHECK ([status] IN ('pending', 'paid'))\n" +
        ");",
      "sqlserver",
    );

    const orders = schema.tables[0];
    expect(orders.name).toBe("orders");
    expect(orders.columns.find((c) => c.name === "id")!.isIncrement).toBe(true);

    const status = orders.columns.find((c) => c.name === "status")!;
    expect(status.type).toBe("orders_status");
    expect(schema.enums).toEqual([{ name: "orders_status", values: ["pending", "paid"] }]);
  });

  it("interpreta ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY", () => {
    const schema = okSchema(
      `CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER);
      ALTER TABLE posts ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id);`,
      "postgres",
    );

    expect(schema.refs).toEqual([
      {
        left: { table: "posts", column: "user_id", cardinality: "many" },
        right: { table: "users", column: "id", cardinality: "one" },
      },
    ]);
  });

  it("ignora comentarios de línea, bloque y estilo MySQL (#)", () => {
    const schema = okSchema(
      "-- comentario de línea\n" +
        "CREATE TABLE users ( -- otro comentario\n" +
        "  id INTEGER PRIMARY KEY, # comentario mysql\n" +
        "  /* bloque\n     multilínea */ name VARCHAR(50)\n" +
        ");",
      "mysql",
    );
    expect(schema.tables[0].columns.map((c) => c.name)).toEqual(["id", "name"]);
  });

  it("representa una PRIMARY KEY compuesta marcando cada columna (idioma DBML habitual)", () => {
    const schema = okSchema(
      `CREATE TABLE memberships (
        user_id INTEGER,
        org_id INTEGER,
        PRIMARY KEY (user_id, org_id)
      );`,
      "postgres",
    );

    const memberships = schema.tables[0];
    expect(memberships.columns.every((c) => c.isPrimaryKey)).toBe(true);
  });

  it("avisa y descarta una restricción UNIQUE compuesta (no representable en el modelo)", () => {
    const schema = okSchema(
      `CREATE TABLE memberships (
        user_id INTEGER,
        org_id INTEGER,
        UNIQUE (user_id, org_id)
      );`,
      "postgres",
    );

    expect(schema.tables[0].columns.every((c) => !c.isUnique)).toBe(true);
    expect(schema.warnings.some((w) => w.includes("UNIQUE compuesta"))).toBe(true);
  });

  it("avisa y descarta relaciones que apuntan a una tabla o columna inexistente", () => {
    const schema = okSchema(
      `CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        FOREIGN KEY (author_id) REFERENCES users (id)
      );`,
      "postgres",
    );
    expect(schema.refs).toHaveLength(0);
    expect(schema.warnings.some((w) => w.includes("relación"))).toBe(true);
  });

  it("avisa y descarta una segunda declaración de una tabla repetida", () => {
    const schema = okSchema(
      `CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(100));`,
      "postgres",
    );
    expect(schema.tables).toHaveLength(1);
    expect(schema.warnings.some((w) => w.includes("repetida"))).toBe(true);
  });
});
