const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// El contacto va en el header From, no en el User-Agent: los WAF de estas
// tiendas rechazan cadenas con '@' y paréntesis extra ahí.
const CONTACTO = process.env.FARMACIA_CONTACTO ?? "contacto@ejemplo.com";

export const TIMEOUT_MS = 15_000;

export function cabecerasBase(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "es-CO,es;q=0.9",
    From: CONTACTO,
  };
}

export function esErrorDeTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function describirError(error: unknown): string {
  return error instanceof Error ? error.constructor.name : "Error";
}

export async function fetchConTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const controlador = new AbortController();
  const id = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controlador.signal });
  } finally {
    clearTimeout(id);
  }
}
