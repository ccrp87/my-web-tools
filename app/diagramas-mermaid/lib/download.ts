export type DiagramFileExtension = "svg" | "png";

/** Nombre de archivo estable para el diagrama exportado, sin depender del tipo de diagrama. */
export function buildDiagramFileName(
  extension: DiagramFileExtension,
): string {
  return `diagrama-mermaid.${extension}`;
}
