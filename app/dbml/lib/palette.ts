export interface ErPalette {
  tableBackground: string;
  tableBorder: string;
  headerBackground: string;
  headerText: string;
  rowDivider: string;
  columnNameText: string;
  columnTypeText: string;
  primaryKeyAccent: string;
  foreignKeyAccent: string;
  relationLine: string;
  canvasBackground: string;
  gridLine: string;
}

export const LIGHT_PALETTE: ErPalette = {
  tableBackground: "#ffffff",
  tableBorder: "rgba(0,0,0,0.14)",
  headerBackground: "#4f46e5",
  headerText: "#ffffff",
  rowDivider: "rgba(0,0,0,0.07)",
  columnNameText: "#18181b",
  columnTypeText: "#71717a",
  primaryKeyAccent: "#b45309",
  foreignKeyAccent: "#0f766e",
  relationLine: "#a1a1aa",
  canvasBackground: "#ffffff",
  gridLine: "rgba(0,0,0,0.07)",
};

export const DARK_PALETTE: ErPalette = {
  tableBackground: "#18181b",
  tableBorder: "rgba(255,255,255,0.14)",
  headerBackground: "#4338ca",
  headerText: "#f4f4f5",
  rowDivider: "rgba(255,255,255,0.09)",
  columnNameText: "#f4f4f5",
  columnTypeText: "#a1a1aa",
  primaryKeyAccent: "#fbbf24",
  foreignKeyAccent: "#5eead4",
  relationLine: "#71717a",
  canvasBackground: "#09090b",
  gridLine: "rgba(255,255,255,0.18)",
};

export function getPalette(isDarkTheme: boolean): ErPalette {
  return isDarkTheme ? DARK_PALETTE : LIGHT_PALETTE;
}
