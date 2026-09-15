export type UnidadBase = "ml" | "g";
export type UnidadPrecio = "L" | "kg";

export interface Presentacion {
  /** Cantidad normalizada a la unidad base (mL para volumen, g para peso). */
  cantidad: number;
  unidad: UnidadBase;
}

export interface PrecioPorUnidad {
  /** Precio por litro (si la unidad base es mL) o por kilogramo (si es g). */
  valor: number;
  unidad: UnidadPrecio;
}

const UNIDADES: ReadonlyArray<{
  patron: string;
  unidad: UnidadBase;
  factor: number;
}> = [
  { patron: "ml|mls|cc", unidad: "ml", factor: 1 },
  { patron: "l|lt|lts|litros?", unidad: "ml", factor: 1000 },
  { patron: "kg|kgs?|kilos?", unidad: "g", factor: 1000 },
  { patron: "g|gr|grs?|gramos?", unidad: "g", factor: 1 },
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

/** Precio por litro (volumen) o por kilogramo (peso), a partir de la presentación normalizada. */
export function calcularPrecioPorUnidad(
  precio: number,
  presentacion: Presentacion,
): PrecioPorUnidad {
  const cantidadEnUnidadGrande = presentacion.cantidad / 1000;
  return {
    valor: precio / cantidadEnUnidadGrande,
    unidad: presentacion.unidad === "ml" ? "L" : "kg",
  };
}

export function formatearPrecioPorUnidad(p: PrecioPorUnidad): string {
  return `$${Math.round(p.valor).toLocaleString("es-CO")}/${p.unidad}`;
}

/** Texto compacto de la presentación en su unidad más legible (1000ml -> "1 L", 900g -> "900 g"). */
export function formatearPresentacion(p: Presentacion): string {
  const grande = p.unidad === "ml" ? "L" : "kg";
  if (p.cantidad >= 1000) {
    return `${(p.cantidad / 1000).toLocaleString("es-CO")} ${grande}`;
  }
  return `${p.cantidad.toLocaleString("es-CO")} ${p.unidad}`;
}
