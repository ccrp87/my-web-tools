export function formatearPrecio(precio: number | null): string {
  if (precio === null) {
    return "—";
  }
  return `$${Math.round(precio).toLocaleString("es-CO")}`;
}

/** "$ 12.500,00" -> 12500 (punto = miles, coma = decimal, formato colombiano). */
export function limpiarPrecio(texto: string): number | null {
  if (!texto) {
    return null;
  }

  let limpio = texto.replace(/[^\d,.]/g, "");
  if (limpio.includes(",")) {
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    limpio = limpio.replace(/\./g, "");
  }

  const valor = Number.parseFloat(limpio);
  return Number.isNaN(valor) ? null : valor;
}
