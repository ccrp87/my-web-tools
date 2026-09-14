import type { Resultado, RespuestaTienda } from "./tipos";

/** El más barato entre los disponibles; si ninguno está disponible, el más barato de todos. */
export function calcularMejor(respuestas: RespuestaTienda[]): Resultado | null {
  const conPrecio = respuestas
    .flatMap((r) => r.resultados)
    .filter((r): r is Resultado & { precio: number } => r.precio !== null);

  if (conPrecio.length === 0) {
    return null;
  }

  const disponibles = conPrecio.filter((r) => r.disponible);
  const candidatos = disponibles.length > 0 ? disponibles : conPrecio;

  return candidatos.reduce((mejor, actual) =>
    actual.precio < mejor.precio ? actual : mejor,
  );
}
