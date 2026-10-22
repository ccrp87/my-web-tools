import { getSvgPixelDimensions } from "./lib/svgDimensions";

const PNG_EXPORT_SCALE: number = 2;

function downloadBlob(blob: Blob, fileName: string): void {
  const url: string = URL.createObjectURL(blob);
  try {
    const link: HTMLAnchorElement = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadSvgMarkup(svgMarkup: string, fileName: string): void {
  const blob: Blob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  downloadBlob(blob, fileName);
}

function loadSvgAsImage(svgMarkup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image: HTMLImageElement = new Image();
    image.onload = (): void => resolve(image);
    image.onerror = (): void =>
      reject(new Error("No se pudo preparar el diagrama para exportar."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });
}

async function svgToPngBlob(
  svgMarkup: string,
  backgroundColor: string,
): Promise<Blob> {
  const { width, height } = getSvgPixelDimensions(svgMarkup);
  const canvas: HTMLCanvasElement = document.createElement("canvas");
  canvas.width = Math.round(width * PNG_EXPORT_SCALE);
  canvas.height = Math.round(height * PNG_EXPORT_SCALE);

  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo preparar el lienzo para exportar el PNG.");
  }

  const image: HTMLImageElement = await loadSvgAsImage(svgMarkup);
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("No se pudo generar el archivo PNG."));
      }
    }, "image/png");
  });
}

export async function downloadPngFromSvg(
  svgMarkup: string,
  fileName: string,
  backgroundColor: string,
): Promise<void> {
  const blob: Blob = await svgToPngBlob(svgMarkup, backgroundColor);
  downloadBlob(blob, fileName);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
