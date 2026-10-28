import type { DbmlRef, DbmlSchema, DbmlTable, DbmlTableGroup } from "./parser/types";
import { estimateTextWidth } from "./textWidth";

export interface LayoutConfig {
  fontSize: number;
  headerHeight: number;
  rowHeight: number;
  minTableWidth: number;
  horizontalPadding: number;
  /** Espacio reservado a la izquierda para el ícono de llave/FK de cada fila. */
  iconGutter: number;
  /** Separación horizontal entre columnas del empaquetado tipo mampostería. */
  columnGap: number;
  /** Separación vertical entre tablas apiladas en la misma columna visual. */
  rowGap: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  fontSize: 12,
  headerHeight: 32,
  rowHeight: 22,
  minTableWidth: 170,
  horizontalPadding: 12,
  iconGutter: 18,
  columnGap: 70,
  rowGap: 50,
};

export interface TableBoxSize {
  width: number;
  height: number;
}

/**
 * Calcula el tamaño de la caja de una tabla a partir de la longitud de sus
 * textos (nombre de la tabla y "nombre + tipo" de cada columna), no de una
 * medición real en el DOM, para que el layout sea una función pura.
 */
export function computeTableBoxSize(
  table: DbmlTable,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): TableBoxSize {
  const titleWidth =
    estimateTextWidth(table.alias ?? table.name, config.fontSize + 1) +
    config.horizontalPadding * 2;

  const widestRow = table.columns.reduce((max, column) => {
    // nombre + separador + tipo, más un margen para que no queden pegados
    const rowText = `${column.name}   ${column.type}`;
    const rowWidth =
      estimateTextWidth(rowText, config.fontSize) +
      config.horizontalPadding * 2 +
      config.iconGutter;
    return Math.max(max, rowWidth);
  }, 0);

  const width = Math.max(config.minTableWidth, titleWidth, widestRow);
  const rowCount = Math.max(1, table.columns.length);
  const height = config.headerHeight + rowCount * config.rowHeight;

  return { width, height };
}

export interface TableBox {
  table: DbmlTable;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Posición Y (relativa al borde superior de la caja) del centro de cada fila de columna. */
  columnRowCenterY: Map<string, number>;
}

export interface ErLayout {
  tableBoxes: TableBox[];
  width: number;
  height: number;
  /** Desplazamiento aplicado a todas las cajas para que ninguna quede en coordenadas negativas. */
  shiftX: number;
  shiftY: number;
}

/**
 * Empaqueta las tablas en columnas visuales tipo "mampostería" (cada tabla
 * nueva va a la columna más corta hasta el momento), en el orden en que
 * aparecen en el código. Es determinístico y no intenta minimizar cruces de
 * líneas como lo haría un layout de grafo con fuerzas: para esquemas de
 * tamaño típico (decenas de tablas) da un resultado compacto y legible sin
 * necesitar esa complejidad.
 */
export function computeErLayout(
  schema: DbmlSchema,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): ErLayout {
  const tableCount = schema.tables.length;
  if (tableCount === 0) {
    return { tableBoxes: [], width: config.minTableWidth, height: config.headerHeight, shiftX: 0, shiftY: 0 };
  }

  const columnCount = Math.max(1, Math.round(Math.sqrt(tableCount)));
  const columnWidths = new Array(columnCount).fill(config.minTableWidth);
  const columnHeights = new Array(columnCount).fill(0);

  const sized = schema.tables.map((table) => ({
    table,
    size: computeTableBoxSize(table, config),
  }));

  const columnAssignment: number[] = sized.map(({ size }) => {
    let shortestColumn = 0;
    for (let column = 1; column < columnCount; column += 1) {
      if (columnHeights[column] < columnHeights[shortestColumn]) {
        shortestColumn = column;
      }
    }
    columnWidths[shortestColumn] = Math.max(columnWidths[shortestColumn], size.width);
    columnHeights[shortestColumn] += size.height + config.rowGap;
    return shortestColumn;
  });

  const columnStartX: number[] = [];
  let cursorX = 0;
  for (let column = 0; column < columnCount; column += 1) {
    columnStartX.push(cursorX);
    cursorX += columnWidths[column] + config.columnGap;
  }

  const columnCursorY = new Array(columnCount).fill(0);
  const tableBoxes: TableBox[] = sized.map(({ table, size }, index) => {
    const column = columnAssignment[index];
    const x = columnStartX[column];
    const y = columnCursorY[column];
    columnCursorY[column] += size.height + config.rowGap;

    const columnRowCenterY = new Map<string, number>();
    table.columns.forEach((dbmlColumn, rowIndex) => {
      columnRowCenterY.set(
        dbmlColumn.name,
        config.headerHeight + rowIndex * config.rowHeight + config.rowHeight / 2,
      );
    });

    return { table, x, y, width: size.width, height: size.height, columnRowCenterY };
  });

  // columnStartX[last] ya es la suma de los anchos y espacios de TODAS las
  // columnas anteriores (sin incluir el ancho de la última columna todavía),
  // así que sumarle el ancho de la última columna da el borde derecho real
  // sin espacio sobrante: a diferencia de columnCursorY (que sí arrastra un
  // espacio final de más por cada tabla, incluida la última de su columna),
  // aquí no hay que restar nada.
  const totalWidth: number = columnStartX[columnCount - 1] + columnWidths[columnCount - 1];
  const totalHeight = Math.max(...columnCursorY.map((h) => Math.max(0, h - config.rowGap)));

  return { tableBoxes, width: totalWidth, height: totalHeight, shiftX: 0, shiftY: 0 };
}

export type RefSide = "left" | "right";

export interface RefPathPoint {
  x: number;
  y: number;
}

export interface RefPath {
  ref: DbmlRef;
  from: RefPathPoint;
  to: RefPathPoint;
  fromSide: RefSide;
  toSide: RefSide;
}

/**
 * Calcula, para cada relación válida del esquema, el punto exacto (borde
 * izquierdo o derecho de la fila de la columna correspondiente) donde debe
 * nacer y terminar su línea de conexión.
 */
export function computeRefPaths(schema: DbmlSchema, layout: ErLayout): RefPath[] {
  const boxByTableName = new Map(layout.tableBoxes.map((box) => [box.table.name, box]));
  const paths: RefPath[] = [];

  for (const ref of schema.refs) {
    const fromBox = boxByTableName.get(ref.left.table);
    const toBox = boxByTableName.get(ref.right.table);
    if (!fromBox || !toBox) continue;

    const fromRowCenterY = fromBox.columnRowCenterY.get(ref.left.column);
    const toRowCenterY = toBox.columnRowCenterY.get(ref.right.column);
    if (fromRowCenterY === undefined || toRowCenterY === undefined) continue;

    const fromCenterX = fromBox.x + fromBox.width / 2;
    const toCenterX = toBox.x + toBox.width / 2;
    const fromSide: RefSide = toCenterX >= fromCenterX ? "right" : "left";
    const toSide: RefSide = fromCenterX >= toCenterX ? "right" : "left";

    paths.push({
      ref,
      from: {
        x: fromSide === "right" ? fromBox.x + fromBox.width : fromBox.x,
        y: fromBox.y + fromRowCenterY,
      },
      to: {
        x: toSide === "right" ? toBox.x + toBox.width : toBox.x,
        y: toBox.y + toRowCenterY,
      },
      fromSide,
      toSide,
    });
  }

  return paths;
}

export interface PositionOverride {
  x: number;
  y: number;
}

/**
 * Sustituye la posición calculada de las tablas que el usuario haya movido
 * a mano, y expande el tamaño del lienzo si alguna quedó fuera de los
 * límites originales (p. ej. al arrastrarla hacia la derecha).
 *
 * Si alguna tabla quedó en coordenadas negativas (arrastrada por encima o a
 * la izquierda del origen), todo el lienzo se desplaza (`shiftX`/`shiftY`)
 * para que esa tabla vuelva a caer dentro del área visible y se pueda
 * alcanzar haciendo scroll — de lo contrario quedaría recortada fuera del
 * `viewBox`, sin forma de desplazarse hasta coordenadas negativas.
 * `overrides` siempre se interpreta en el espacio de coordenadas SIN
 * desplazar (el mismo que produce `computeErLayout`), para que este
 * desplazamiento no se acumule entre renders sucesivos.
 */
export function applyPositionOverrides(
  layout: ErLayout,
  overrides: Readonly<Record<string, PositionOverride>>,
): ErLayout {
  if (Object.keys(overrides).length === 0) return layout;

  const rawBoxes: TableBox[] = layout.tableBoxes.map((box) => {
    const override = overrides[box.table.name];
    return override ? { ...box, x: override.x, y: override.y } : box;
  });

  const shiftX: number = Math.max(0, -Math.min(0, ...rawBoxes.map((box) => box.x)));
  const shiftY: number = Math.max(0, -Math.min(0, ...rawBoxes.map((box) => box.y)));

  const tableBoxes: TableBox[] =
    shiftX === 0 && shiftY === 0
      ? rawBoxes
      : rawBoxes.map((box) => ({ ...box, x: box.x + shiftX, y: box.y + shiftY }));

  const width = Math.max(layout.width + shiftX, ...tableBoxes.map((box) => box.x + box.width));
  const height = Math.max(layout.height + shiftY, ...tableBoxes.map((box) => box.y + box.height));

  return { tableBoxes, width, height, shiftX, shiftY };
}

export interface GroupBounds {
  group: DbmlTableGroup;
  x: number;
  y: number;
  width: number;
  height: number;
}

const GROUP_PADDING: number = 20;
const GROUP_LABEL_HEIGHT: number = 24;
const EMPTY_GROUP_WIDTH: number = 180;
const EMPTY_GROUP_HEIGHT: number = 70;
const EMPTY_GROUP_GAP: number = 20;

/**
 * Calcula el rectángulo que envuelve a las tablas miembro de cada área
 * (con margen y espacio para la etiqueta). Un área sin tablas todavía
 * (recién creada) no tiene de dónde derivar una posición, así que se le
 * da una caja "flotante" debajo del resto del diagrama, para que el
 * usuario pueda verla y asignarle tablas.
 */
export function computeGroupBounds(
  tableGroups: readonly DbmlTableGroup[],
  layout: ErLayout,
): GroupBounds[] {
  const boxByTableName = new Map(layout.tableBoxes.map((box) => [box.table.name, box]));
  const bounds: GroupBounds[] = [];
  let emptyGroupIndex: number = 0;

  for (const group of tableGroups) {
    const memberBoxes: TableBox[] = group.tables
      .map((name) => boxByTableName.get(name))
      .filter((box): box is TableBox => box !== undefined);

    if (memberBoxes.length === 0) {
      bounds.push({
        group,
        x: emptyGroupIndex * (EMPTY_GROUP_WIDTH + EMPTY_GROUP_GAP),
        y: layout.height + EMPTY_GROUP_GAP,
        width: EMPTY_GROUP_WIDTH,
        height: EMPTY_GROUP_HEIGHT,
      });
      emptyGroupIndex += 1;
      continue;
    }

    const minX: number = Math.min(...memberBoxes.map((box) => box.x));
    const minY: number = Math.min(...memberBoxes.map((box) => box.y));
    const maxX: number = Math.max(...memberBoxes.map((box) => box.x + box.width));
    const maxY: number = Math.max(...memberBoxes.map((box) => box.y + box.height));

    bounds.push({
      group,
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_LABEL_HEIGHT,
      width: maxX - minX + GROUP_PADDING * 2,
      height: maxY - minY + GROUP_PADDING * 2 + GROUP_LABEL_HEIGHT,
    });
  }

  return bounds;
}
