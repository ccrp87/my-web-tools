/** Separa una lista de settings `a, b: 'c, d', e` respetando comas dentro de comillas. */
export function splitSettingsList(raw: string): string[] {
  const parts: string[] = [];
  let current: string = "";
  let quote: string | null = null;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (quote) {
      current += char;
      if (char === quote && raw[i - 1] !== "\\") quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === ",") {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim() !== "") parts.push(current.trim());
  return parts.filter((part) => part !== "");
}

/** Quita comillas simples o dobles si envuelven todo el valor. */
export function unquote(value: string): string {
  const trimmed: string = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
