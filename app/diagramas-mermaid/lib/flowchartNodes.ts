function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pares de delimitadores de forma de nodo en flowchart, del más específico
 * al más genérico (p. ej. el círculo "((...))" debe probarse antes que el
 * redondeado "(...)", o este lo capturaría primero).
 */
interface ShapeDelimiter {
  open: string;
  close: string;
}

const SHAPE_DELIMITERS: readonly ShapeDelimiter[] = [
  { open: "{{", close: "}}" },
  { open: "([", close: "])" },
  { open: "[[", close: "]]" },
  { open: "[(", close: ")]" },
  { open: "((", close: "))" },
  { open: "{", close: "}" },
  { open: "[", close: "]" },
  { open: "(", close: ")" },
];

/**
 * A partir del id completo que Mermaid asigna al <g> de un nodo en el SVG
 * (que incluye el id de render que nosotros generamos, más un contador
 * interno), recupera el id del nodo tal como aparece en el código fuente.
 */
export function extractFlowchartNodeId(
  svgGroupId: string,
  renderId: string,
): string | null {
  if (!svgGroupId.startsWith(renderId)) return null;

  const suffix: string = svgGroupId.slice(renderId.length);
  const match = suffix.match(/^-flowchart-(.+)-\d+$/);
  return match ? match[1] : null;
}

/**
 * Reemplaza la etiqueta de un nodo (`ID[Texto]`, `ID(Texto)`, `ID{Texto}`,
 * etc.) por un texto nuevo, conservando la forma del nodo. Devuelve null si
 * no se encuentra una declaración de forma reconocible para ese id, para que
 * quien llame pueda avisar en vez de corromper el código en silencio.
 */
export function replaceFlowchartNodeLabel(
  code: string,
  nodeId: string,
  newLabel: string,
): string | null {
  const escapedId: string = escapeRegExp(nodeId);

  for (const { open, close } of SHAPE_DELIMITERS) {
    const pattern = new RegExp(
      `(?<![A-Za-z0-9_])${escapedId}${escapeRegExp(open)}([\\s\\S]*?)${escapeRegExp(close)}`,
    );
    const match = code.match(pattern);
    if (match && match.index !== undefined) {
      const before: string = code.slice(0, match.index);
      const after: string = code.slice(match.index + match[0].length);
      return `${before}${nodeId}${open}${newLabel}${close}${after}`;
    }
  }

  return null;
}

function upsertStyleProperty(
  propertyList: string,
  property: string,
  value: string,
): string {
  const entries: string[] = propertyList
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const propertyPrefix: string = `${property}:`;
  const existingIndex: number = entries.findIndex((entry) =>
    entry.toLowerCase().startsWith(propertyPrefix.toLowerCase()),
  );

  if (existingIndex >= 0) {
    entries[existingIndex] = `${property}:${value}`;
  } else {
    entries.push(`${property}:${value}`);
  }

  return entries.join(",");
}

/**
 * Crea o actualiza la línea `style ID fill:#color` del nodo indicado,
 * conservando el resto de propiedades de estilo que ya tuviera.
 */
export function upsertFlowchartNodeStyle(
  code: string,
  nodeId: string,
  fillColor: string,
): string {
  const styleLinePattern = new RegExp(
    `^([ \\t]*style\\s+${escapeRegExp(nodeId)}\\b)(.*)$`,
    "m",
  );

  if (styleLinePattern.test(code)) {
    return code.replace(styleLinePattern, (_fullMatch, prefix: string, rest: string) => {
      const updatedProperties: string = upsertStyleProperty(rest, "fill", fillColor);
      return `${prefix} ${updatedProperties}`;
    });
  }

  const separator: string = code.endsWith("\n") ? "" : "\n";
  return `${code}${separator}style ${nodeId} fill:${fillColor}\n`;
}
