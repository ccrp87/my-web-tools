/**
 * Parte el término en (palabra_para_la_API, filtros_locales).
 *
 * Los sitios VTEX tienen un WAF que responde "Scripts are not allowed!"
 * ante cualquier espacio en la consulta, así que solo se puede mandar UNA
 * palabra. Se elige la más larga por ser la más distintiva
 * ("acetaminofen" discrimina mucho más que "500"), y el resto se filtra en
 * servidor con los datos ya en mano.
 */
export function tokenizarTermino(termino: string): {
  clave: string;
  filtros: string[];
} {
  const tokens = termino.split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  if (tokens.length === 0) {
    return { clave: termino.trim(), filtros: [] };
  }

  const clave = tokens.reduce((a, b) => (b.length > a.length ? b : a));
  return { clave, filtros: tokens.filter((t) => t !== clave) };
}
