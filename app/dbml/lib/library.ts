export interface SavedDiagram {
  id: string;
  name: string;
  code: string;
  updatedAt: number;
}

/** Más recientes primero, para que lo último guardado aparezca arriba de la lista. */
export function sortByUpdatedAtDesc(diagrams: readonly SavedDiagram[]): SavedDiagram[] {
  return [...diagrams].sort((a, b) => b.updatedAt - a.updatedAt);
}
