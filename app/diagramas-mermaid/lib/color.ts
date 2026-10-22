function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

/**
 * Convierte un color CSS calculado (`rgb(r, g, b)` o `rgba(r, g, b, a)`) a
 * `#rrggbb`, para poder usarlo como valor de un `<input type="color">`.
 * Devuelve null si el texto no tiene ese formato (p. ej. "none").
 */
export function rgbStringToHex(rgbColor: string): string | null {
  const match = rgbColor.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*[0-9.]+\s*)?\)$/i,
  );
  if (!match) return null;

  const [, r, g, b] = match;
  return `#${toHexByte(Number(r))}${toHexByte(Number(g))}${toHexByte(Number(b))}`;
}
