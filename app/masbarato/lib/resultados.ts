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
 * (precio por mililitro o por gramo) solo se usa cuando TODOS los items
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

export type CriterioOrden = "total" | "unidad";

/**
 * Todos los resultados (de todas las tiendas) ordenados de más barato a más
 * caro según `criterio`: "total" usa el precio tal cual lo muestra la
 * tienda; "unidad" usa el precio por mililitro/gramo/unidad, sin exigir que
 * todos compartan la misma unidad de medida — es una elección explícita del
 * usuario, no la comparación "justa" automática de `calcularMejor`. En
 * ambos modos, los resultados sin precio quedan al final, en el orden en
 * que llegaron; en modo "unidad", los que sí tienen precio pero no traen
 * presentación reconocible quedan justo antes de esos (no se puede ordenar
 * lo que no se puede medir).
 */
export function ordenarPorPrecio(
  resultados: Resultado[],
  criterio: CriterioOrden = "total",
): Resultado[] {
  const conPrecio = resultados.filter(
    (r): r is ResultadoConPrecio => r.precio !== null,
  );
  const sinPrecio = resultados.filter((r) => r.precio === null);

  if (criterio === "unidad") {
    const conUnidad: Array<{ r: ResultadoConPrecio; valor: number }> = [];
    const sinUnidad: ResultadoConPrecio[] = [];
    for (const r of conPrecio) {
      const porUnidad = precioPorUnidadDe(r);
      if (porUnidad) {
        conUnidad.push({ r, valor: porUnidad.valor });
      } else {
        sinUnidad.push(r);
      }
    }
    conUnidad.sort((a, b) => a.valor - b.valor);
    return [...conUnidad.map((x) => x.r), ...sinUnidad, ...sinPrecio];
  }

  const ordenados = [...conPrecio].sort((a, b) => a.precio - b.precio);
  return [...ordenados, ...sinPrecio];
}
