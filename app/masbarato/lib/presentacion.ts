export type UnidadBase = "ml" | "g" | "unidad";
export type UnidadPrecio = UnidadBase;

export interface Presentacion {
  /** Cantidad normalizada a la unidad base (mL para volumen, g para peso, conteo para unidades). */
  cantidad: number;
  unidad: UnidadBase;
}

export interface PrecioPorUnidad {
  /** Precio por mililitro/gramo, o por unidad individual si se vende por conteo. */
  valor: number;
  unidad: UnidadPrecio;
}

/** Símbolo compacto para el precio por unidad (ej. "$40/ml", "$833/u"). */
const SIMBOLO_PRECIO: Record<UnidadBase, string> = { ml: "ml", g: "g", unidad: "u" };

const UNIDADES: ReadonlyArray<{
  patron: string;
  unidad: UnidadBase;
  factor: number;
}> = [
  { patron: "ml|mls|cc", unidad: "ml", factor: 1 },
  { patron: "l|lt|lts|litros?", unidad: "ml", factor: 1000 },
  { patron: "kg|kgs?|kilos?", unidad: "g", factor: 1000 },
  { patron: "g|gr|grs?|gramos?", unidad: "g", factor: 1 },
  // Solo la palabra explícita ("12 unidades", "x3 uds"): un "x3" suelto sin
  // ella es demasiado ambiguo con tallas ("Talla X 3") o medidas ("50x30cm")
  // para arriesgar un precio por unidad inventado.
  { patron: "unidades?|unds?|uds?", unidad: "unidad", factor: 1 },
];

const ALTERNATIVAS = UNIDADES.map((u) => u.patron).join("|");

// Multipack primero ("2x500ml"): si no se busca antes, la variante simple
// igual encontraría el "500ml" pero perdería el "2x" y subestimaría el total.
const REGEX_MULTIPACK = new RegExp(
  `(\\d+)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${ALTERNATIVAS})(?![a-zA-Z])`,
  "i",
);
const REGEX_SIMPLE = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${ALTERNATIVAS})(?![a-zA-Z])`,
  "i",
);

function resolverUnidad(
  token: string,
): { unidad: UnidadBase; factor: number } | null {
  const normalizado = token.toLowerCase();
  for (const u of UNIDADES) {
    if (new RegExp(`^(?:${u.patron})$`, "i").test(normalizado)) {
      return { unidad: u.unidad, factor: u.factor };
    }
  }
  return null;
}

function aNumero(texto: string): number | null {
  const valor = Number.parseFloat(texto.replace(",", "."));
  return Number.isNaN(valor) ? null : valor;
}

/**
 * Extrae la presentación (volumen o peso) del nombre de un producto, ej.
 * "Coca-Cola 1.5L" -> {cantidad: 1500, unidad: "ml"} o "Chunky 12 kilos" ->
 * {cantidad: 12000, unidad: "g"}. Reconoce multipacks ("2x500ml" -> 1000ml).
 * Devuelve null si el nombre no trae ninguna cantidad reconocible: no toda
 * comparación de precio es justa, y es mejor omitir el precio por unidad que
 * inventarlo.
 */
export function extraerPresentacion(nombre: string): Presentacion | null {
  const multipack = REGEX_MULTIPACK.exec(nombre);
  if (multipack) {
    const [, cuenta, valorUnitario, unidadTexto] = multipack;
    const resuelta = resolverUnidad(unidadTexto);
    const n = aNumero(cuenta);
    const valor = aNumero(valorUnitario);
    if (resuelta && n && valor && n > 0 && valor > 0) {
      return { cantidad: n * valor * resuelta.factor, unidad: resuelta.unidad };
    }
  }

  const simple = REGEX_SIMPLE.exec(nombre);
  if (simple) {
    const [, valorTexto, unidadTexto] = simple;
    const resuelta = resolverUnidad(unidadTexto);
    const valor = aNumero(valorTexto);
    if (resuelta && valor && valor > 0) {
      return { cantidad: valor * resuelta.factor, unidad: resuelta.unidad };
    }
  }

  return null;
}

/** Precio por mililitro (volumen) o por gramo (peso), a partir de la presentación normalizada. */
export function calcularPrecioPorUnidad(
  precio: number,
  presentacion: Presentacion,
): PrecioPorUnidad {
  return {
    valor: precio / presentacion.cantidad,
    unidad: presentacion.unidad,
  };
}

/**
 * A diferencia del precio total (siempre en pesos enteros), el precio por
 * mL/g suele quedar por debajo de $1 en productos grandes o baratos (ej.
 * agua a $2.000/L es $2/mL, pero un detergente de 3L a $9.000 es
 * $0,30/mL): redondear a entero lo dejaría en "$0" y ocultaría la
 * comparación. Se muestran hasta 2 decimales, sin ceros de más.
 */
export function formatearPrecioPorUnidad(p: PrecioPorUnidad): string {
  const valor = p.valor.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `$${valor}/${SIMBOLO_PRECIO[p.unidad]}`;
}

/**
 * Texto compacto de la presentación en su unidad más legible (1000ml -> "1
 * L", 900g -> "900 g", conteo -> "12 uds": no aplica la agrupación en
 * L/kg, que no tiene sentido para algo que ya es una cantidad de piezas).
 */
export function formatearPresentacion(p: Presentacion): string {
  if (p.unidad === "unidad") {
    return `${p.cantidad.toLocaleString("es-CO")} uds`;
  }
  const grande = p.unidad === "ml" ? "L" : "kg";
  if (p.cantidad >= 1000) {
    return `${(p.cantidad / 1000).toLocaleString("es-CO")} ${grande}`;
  }
  return `${p.cantidad.toLocaleString("es-CO")} ${p.unidad}`;
}
