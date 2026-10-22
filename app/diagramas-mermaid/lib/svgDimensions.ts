export interface SvgPixelDimensions {
  width: number;
  height: number;
}

const FALLBACK_DIMENSIONS: SvgPixelDimensions = { width: 800, height: 600 };

function extractAttributeValue(rootTag: string, attribute: string): number | null {
  const match = rootTag.match(new RegExp(`${attribute}="([0-9.]+)`, "i"));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractViewBoxDimensions(rootTag: string): SvgPixelDimensions | null {
  const match = rootTag.match(/viewBox="([^"]+)"/i);
  if (!match) return null;

  const parts = match[1].trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || !parts.every((part) => Number.isFinite(part))) {
    return null;
  }

  const [, , width, height] = parts;
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Lee el tamaño en píxeles de un SVG a partir de su marcado (sin DOM), para
 * poder dimensionar el lienzo de exportación a PNG. Mermaid no siempre
 * incluye width/height explícitos, así que se recurre al viewBox como
 * respaldo.
 */
export function getSvgPixelDimensions(svgMarkup: string): SvgPixelDimensions {
  const rootTagMatch = svgMarkup.match(/<svg\b[^>]*>/i);
  const rootTag = rootTagMatch ? rootTagMatch[0] : "";

  const width = extractAttributeValue(rootTag, "width");
  const height = extractAttributeValue(rootTag, "height");
  if (width !== null && height !== null) {
    return { width, height };
  }

  return extractViewBoxDimensions(rootTag) ?? FALLBACK_DIMENSIONS;
}
