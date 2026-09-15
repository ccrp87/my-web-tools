// Palabras que no aportan a distinguir un producto de otro ("aceite DE
// oliva" busca lo mismo que "aceite oliva"): se excluyen para no diluir
// la relevancia del término mandado a la tienda o del filtro local.
const PALABRAS_VACIAS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "o",
  "para",
  "con",
  "en",
  "un",
  "una",
  "unos",
  "unas",
]);

/**
 * Palabras del término que realmente distinguen el producto buscado, sin
 * las vacías ("de", "y", "para"...). Si el término es solo palabras vacías
 * (ej. "de la"), se usan todas tal cual en vez de quedar vacío.
 */
export function palabrasSignificativas(termino: string): string[] {
  const tokens = termino.split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }

  const significativos = tokens.filter(
    (t) => !PALABRAS_VACIAS.has(t.toLowerCase()),
  );
  return significativos.length > 0 ? significativos : tokens;
}

/**
 * Parte el término en (palabra_para_la_API, filtros_locales).
 *
 * Los sitios VTEX tienen un WAF que responde "Scripts are not allowed!"
 * ante cualquier espacio en la consulta, pero SÍ acepta un guion como
 * separador — y su propio buscador de texto completo lo trata igual que un
 * espacio (WAF de por medio, se pierde el espacio real, no la posibilidad
 * de mandar varias palabras). Por eso no hace falta reducir la búsqueda a
 * una sola palabra: se manda el término completo (sin las palabras vacías)
 * unido por guiones, y VTEX hace su propio *AND* de relevancia sobre todas
 * ellas — mandar solo la palabra más larga ("aceite" en "aceite de oliva")
 * era el bug real: perdía la palabra que de verdad distingue el producto
 * ("oliva") y el usuario veía cualquier cosa que contuviera "aceite".
 *
 * Los `filtros` (mismas palabras) se usan como una verificación extra en
 * servidor sobre el texto del producto, por si VTEX fuera más laxo con
 * alguna tienda — con una sola palabra no hace falta, ya la lleva `clave`.
 */
export function tokenizarTermino(termino: string): {
  clave: string;
  filtros: string[];
} {
  const relevantes = palabrasSignificativas(termino);
  if (relevantes.length === 0) {
    return { clave: termino.trim(), filtros: [] };
  }

  return {
    clave: relevantes.join("-"),
    filtros: relevantes.length > 1 ? relevantes : [],
  };
}
