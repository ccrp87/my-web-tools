import type { Resultado, RespuestaTienda } from "./tipos";
import {
  calcularPrecioPorUnidad,
  extraerPresentacion,
  type PrecioPorUnidad,
} from "./presentacion";

type ResultadoConPrecio = Resultado & { precio: number };

function precioPorUnidadDe(r: ResultadoConPrecio): PrecioPorUnidad | null {
  const presentacion = r.presentacion ?? extraerPresentacion(r.nombre);
  return presentacion ? calcularPrecioPorUnidad(r.precio, presentacion) : null;
}

/**
 * "Más barato" por precio total solo es justo si todos traen la misma
 * presentación (ej. comparar 1L contra 1L). Por eso el precio normalizado
 * (precio por litro o por kilogramo) solo se usa cuando TODOS los items
 * tienen presentación reconocible y en la misma unidad — si uno solo no la
 * tiene, o hay unidades distintas (ej. mezclando litros y kilogramos), no
 * hay forma de comparar sin excluir en silencio a alguno, así que se cae al
 * precio total.
 */
function elegirComparador(
  items: ResultadoConPrecio[],
): { modo: "unidad" | "total"; valorDe: (r: ResultadoConPrecio) => number } {
  const porUnidadPorItem = new Map<ResultadoConPrecio, PrecioPorUnidad>();
  for (const r of items) {
    const porUnidad = precioPorUnidadDe(r);
    if (porUnidad) {
      porUnidadPorItem.set(r, porUnidad);
    }
  }

  const todosConUnidad = porUnidadPorItem.size === items.length;
  const unidades = new Set([...porUnidadPorItem.values()].map((p) => p.unidad));

  if (items.length >= 2 && todosConUnidad && unidades.size === 1) {
    return {
      modo: "unidad",
      // todosConUnidad garantiza que cada r de items tiene entrada en el mapa.
      valorDe: (r) => porUnidadPorItem.get(r)!.valor,
    };
  }

  return { modo: "total", valorDe: (r) => r.precio };
}

/** El más barato entre los disponibles; si ninguno está disponible, el más barato de todos. */
export function calcularMejor(respuestas: RespuestaTienda[]): Resultado | null {
  const conPrecio = respuestas
    .flatMap((r) => r.resultados)
    .filter((r): r is ResultadoConPrecio => r.precio !== null);

  if (conPrecio.length === 0) {
    return null;
  }

  const disponibles = conPrecio.filter((r) => r.disponible);
  const candidatos = disponibles.length > 0 ? disponibles : conPrecio;

  const { valorDe } = elegirComparador(candidatos);
  return candidatos.reduce((mejor, actual) =>
    valorDe(actual) < valorDe(mejor) ? actual : mejor,
  );
}

/**
 * Todos los resultados (de todas las tiendas) ordenados de más barato a más
 * caro, con el mismo criterio de `calcularMejor` (por unidad cuando todos
 * los que tienen precio son comparables, si no por precio total) — para que
 * el orden de una lista completa nunca contradiga al "★ más barato". Los
 * resultados sin precio quedan al final, en el orden en que llegaron.
 */
export function ordenarPorPrecio(resultados: Resultado[]): Resultado[] {
  const conPrecio = resultados.filter(
    (r): r is ResultadoConPrecio => r.precio !== null,
  );
  const sinPrecio = resultados.filter((r) => r.precio === null);

  const { valorDe } = elegirComparador(conPrecio);
  const ordenados = [...conPrecio].sort((a, b) => valorDe(a) - valorDe(b));

  return [...ordenados, ...sinPrecio];
}
