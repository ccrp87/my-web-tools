import { describe, expect, it } from "vitest";
import {
  applyPositionOverrides,
  computeErLayout,
  computeGroupBounds,
  computeRefPaths,
  computeTableBoxSize,
  DEFAULT_LAYOUT_CONFIG,
} from "./erLayout";
import type { DbmlColumn, DbmlSchema, DbmlTable } from "./parser/types";

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

describe("computeTableBoxSize", () => {
  it("nunca es más angosta que el ancho mínimo configurado", () => {
    const table = makeTable({ name: "a", columns: [makeColumn({ name: "x", type: "int" })] });
    const size = computeTableBoxSize(table);
    expect(size.width).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_CONFIG.minTableWidth);
  });

  it("crece con columnas de nombre/tipo más largos", () => {
    const narrow = makeTable({ columns: [makeColumn({ name: "id", type: "int" })] });
    const wide = makeTable({
      columns: [makeColumn({ name: "very_long_column_name", type: "varchar(255)" })],
    });
    expect(computeTableBoxSize(wide).width).toBeGreaterThan(computeTableBoxSize(narrow).width);
  });

  it("la altura crece linealmente con el número de columnas", () => {
    const oneColumn = makeTable({ columns: [makeColumn()] });
    const threeColumns = makeTable({
      columns: [makeColumn({ name: "a" }), makeColumn({ name: "b" }), makeColumn({ name: "c" })],
    });
    const diff = computeTableBoxSize(threeColumns).height - computeTableBoxSize(oneColumn).height;
    expect(diff).toBeCloseTo(DEFAULT_LAYOUT_CONFIG.rowHeight * 2, 5);
  });

  it("una tabla sin columnas ocupa al menos una fila de alto", () => {
    const empty = makeTable({ columns: [] });
    expect(computeTableBoxSize(empty).height).toBe(
      DEFAULT_LAYOUT_CONFIG.headerHeight + DEFAULT_LAYOUT_CONFIG.rowHeight,
    );
  });
});

describe("computeErLayout", () => {
  it("devuelve un layout vacío si no hay tablas", () => {
    const layout = computeErLayout(makeSchema());
    expect(layout.tableBoxes).toHaveLength(0);
  });

  it("coloca una caja por cada tabla, con coordenadas no negativas", () => {
    const schema = makeSchema({
      tables: [makeTable({ name: "a" }), makeTable({ name: "b" }), makeTable({ name: "c" })],
    });
    const layout = computeErLayout(schema);
    expect(layout.tableBoxes).toHaveLength(3);
    for (const box of layout.tableBoxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("no superpone verticalmente dos tablas que caen en la misma columna visual", () => {
    // Con 4 tablas de igual tamaño, el reparto por columna más corta debería
    // dejar como mucho 2 por columna (columnCount = round(sqrt(4)) = 2).
    const schema = makeSchema({
      tables: [
        makeTable({ name: "a" }),
        makeTable({ name: "b" }),
        makeTable({ name: "c" }),
        makeTable({ name: "d" }),
      ],
    });
    const layout = computeErLayout(schema);

    const byX = new Map<number, typeof layout.tableBoxes>();
    for (const box of layout.tableBoxes) {
      const bucket = byX.get(box.x) ?? [];
      bucket.push(box);
      byX.set(box.x, bucket);
    }

    for (const boxesInColumn of byX.values()) {
      const sorted = [...boxesInColumn].sort((a, b) => a.y - b.y);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i].y).toBeGreaterThanOrEqual(sorted[i - 1].y + sorted[i - 1].height);
      }
    }
  });

  it("el ancho y el alto del layout cubren el borde derecho/inferior de cada caja (ninguna tabla queda fuera del lienzo)", () => {
    const schema = makeSchema({
      tables: [
        makeTable({ name: "a", columns: [makeColumn({ name: "a_very_long_column_name_here", type: "varchar(255)" })] }),
        makeTable({ name: "b" }),
        makeTable({ name: "c" }),
        makeTable({ name: "d" }),
      ],
    });
    const layout = computeErLayout(schema);

    for (const box of layout.tableBoxes) {
      expect(box.x + box.width).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it("calcula el centro vertical de cada fila de columna dentro de la caja", () => {
    const table = makeTable({
      columns: [makeColumn({ name: "id" }), makeColumn({ name: "name" })],
    });
    const layout = computeErLayout(makeSchema({ tables: [table] }));
    const box = layout.tableBoxes[0];

    expect(box.columnRowCenterY.get("id")).toBe(
      DEFAULT_LAYOUT_CONFIG.headerHeight + DEFAULT_LAYOUT_CONFIG.rowHeight / 2,
    );
    expect(box.columnRowCenterY.get("name")).toBe(
      DEFAULT_LAYOUT_CONFIG.headerHeight + DEFAULT_LAYOUT_CONFIG.rowHeight * 1.5,
    );
  });
});

describe("computeRefPaths", () => {
  it("conecta el borde derecho de la tabla de la izquierda con el izquierdo de la de la derecha", () => {
    const users = makeTable({ name: "users", columns: [makeColumn({ name: "id" })] });
    const posts = makeTable({
      name: "posts",
      columns: [
        makeColumn({
          name: "a_much_much_longer_foreign_key_column_name",
          type: "integer",
          isForeignKey: true,
        }),
      ],
    });
    const schema = makeSchema({
      tables: [users, posts],
      refs: [
        {
          left: {
            table: "posts",
            column: "a_much_much_longer_foreign_key_column_name",
            cardinality: "many",
          },
          right: { table: "users", column: "id", cardinality: "one" },
        },
      ],
    });

    const layout = computeErLayout(schema);
    const paths = computeRefPaths(schema, layout);
    expect(paths).toHaveLength(1);

    const [path] = paths;
    const usersBox = layout.tableBoxes.find((box) => box.table.name === "users")!;
    const postsBox = layout.tableBoxes.find((box) => box.table.name === "posts")!;
    const postsCenterX = postsBox.x + postsBox.width / 2;
    const usersCenterX = usersBox.x + usersBox.width / 2;

    if (postsCenterX < usersCenterX) {
      expect(path.fromSide).toBe("right");
      expect(path.from.x).toBe(postsBox.x + postsBox.width);
      expect(path.toSide).toBe("left");
      expect(path.to.x).toBe(usersBox.x);
    } else {
      expect(path.fromSide).toBe("left");
      expect(path.from.x).toBe(postsBox.x);
      expect(path.toSide).toBe("right");
      expect(path.to.x).toBe(usersBox.x + usersBox.width);
    }
  });

  it("ignora una relación si la tabla referenciada no está en el layout", () => {
    const schema = makeSchema({
      tables: [makeTable({ name: "users" })],
      refs: [
        {
          left: { table: "users", column: "id", cardinality: "one" },
          right: { table: "no_existe", column: "x", cardinality: "many" },
        },
      ],
    });
    const layout = computeErLayout(schema);
    expect(computeRefPaths(schema, layout)).toHaveLength(0);
  });
});

describe("applyPositionOverrides", () => {
  it("devuelve el mismo layout si no hay overrides", () => {
    const schema = makeSchema({ tables: [makeTable({ name: "a" })] });
    const layout = computeErLayout(schema);
    expect(applyPositionOverrides(layout, {})).toBe(layout);
  });

  it("reemplaza la posición de la tabla indicada y deja las demás intactas", () => {
    const schema = makeSchema({
      tables: [makeTable({ name: "a" }), makeTable({ name: "b" })],
    });
    const layout = computeErLayout(schema);
    const original = layout.tableBoxes.find((box) => box.table.name === "b")!;

    const moved = applyPositionOverrides(layout, { a: { x: 500, y: 900 } });

    const movedA = moved.tableBoxes.find((box) => box.table.name === "a")!;
    const unchangedB = moved.tableBoxes.find((box) => box.table.name === "b")!;
    expect(movedA.x).toBe(500);
    expect(movedA.y).toBe(900);
    expect(unchangedB.x).toBe(original.x);
    expect(unchangedB.y).toBe(original.y);
  });

  it("expande el ancho/alto del lienzo si una tabla movida queda fuera de los límites originales", () => {
    const schema = makeSchema({ tables: [makeTable({ name: "a" })] });
    const layout = computeErLayout(schema);

    const moved = applyPositionOverrides(layout, { a: { x: 2000, y: 3000 } });
    const box = moved.tableBoxes[0];
    expect(moved.width).toBeGreaterThanOrEqual(box.x + box.width);
    expect(moved.height).toBeGreaterThanOrEqual(box.y + box.height);
  });

  it("ignora un override para una tabla que no existe en el layout", () => {
    const schema = makeSchema({ tables: [makeTable({ name: "a" })] });
    const layout = computeErLayout(schema);
    const moved = applyPositionOverrides(layout, { no_existe: { x: 10, y: 10 } });
    expect(moved.tableBoxes).toEqual(layout.tableBoxes);
  });

  it("desplaza todo el lienzo si una tabla queda en coordenadas negativas, para que no quede recortada fuera de alcance", () => {
    const schema = makeSchema({
      tables: [makeTable({ name: "a" }), makeTable({ name: "b" })],
    });
    const layout = computeErLayout(schema);
    const originalB = layout.tableBoxes.find((box) => box.table.name === "b")!;

    const moved = applyPositionOverrides(layout, { a: { x: -50, y: -30 } });

    const movedA = moved.tableBoxes.find((box) => box.table.name === "a")!;
    const shiftedB = moved.tableBoxes.find((box) => box.table.name === "b")!;

    expect(movedA.x).toBeGreaterThanOrEqual(0);
    expect(movedA.y).toBeGreaterThanOrEqual(0);
    // El resto del lienzo se desplaza junto con la tabla movida, conservando
    // las posiciones relativas entre tablas.
    expect(shiftedB.x - movedA.x).toBe(originalB.x - -50);
    expect(shiftedB.y - movedA.y).toBe(originalB.y - -30);
    expect(moved.width).toBeGreaterThanOrEqual(movedA.x + movedA.width);
    expect(moved.height).toBeGreaterThanOrEqual(movedA.y + movedA.height);
  });

  it("si nada queda negativo, no aplica ningún desplazamiento (shiftX/shiftY en 0)", () => {
    const schema = makeSchema({ tables: [makeTable({ name: "a" })] });
    const layout = computeErLayout(schema);
    const moved = applyPositionOverrides(layout, { a: { x: 10, y: 10 } });
    expect(moved.shiftX).toBe(0);
    expect(moved.shiftY).toBe(0);
  });
});

describe("computeGroupBounds", () => {
  it("envuelve las cajas de las tablas miembro con margen", () => {
    const schema = makeSchema({ tables: [makeTable({ name: "a" }), makeTable({ name: "b" })] });
    const layout = computeErLayout(schema);
    const [boundsA] = computeGroupBounds(
      [{ name: "grupo", color: null, tables: ["a"] }],
      layout,
    );
    const boxA = layout.tableBoxes.find((box) => box.table.name === "a")!;

    expect(boundsA.x).toBeLessThan(boxA.x);
    expect(boundsA.y).toBeLessThan(boxA.y);
    expect(boundsA.x + boundsA.width).toBeGreaterThan(boxA.x + boxA.width);
    expect(boundsA.y + boundsA.height).toBeGreaterThan(boxA.y + boxA.height);
  });

  it("le da una caja flotante a un área sin tablas", () => {
    const schema = makeSchema({ tables: [makeTable({ name: "a" })] });
    const layout = computeErLayout(schema);
    const [bounds] = computeGroupBounds([{ name: "vacía", color: null, tables: [] }], layout);

    expect(bounds.y).toBeGreaterThanOrEqual(layout.height);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  it("no genera cajas para un área cuyas tablas no existen en el layout", () => {
    const schema = makeSchema({ tables: [] });
    const layout = computeErLayout(schema);
    const bounds = computeGroupBounds([{ name: "g", color: null, tables: ["no_existe"] }], layout);
    // Sin tablas en el layout, "no_existe" no resuelve a ninguna caja: se trata como área vacía.
    expect(bounds).toHaveLength(1);
    expect(bounds[0].y).toBeGreaterThanOrEqual(layout.height);
  });
});
