"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent } from "react";
import { formatearPrecio } from "./lib/precio";
import {
  calcularPrecioPorUnidad,
  extraerPresentacion,
  formatearPresentacion,
  formatearPrecioPorUnidad,
} from "./lib/presentacion";
import {
  calcularMejor,
  ordenarPorPrecio,
  type CriterioOrden,
} from "./lib/resultados";
import type { EventoBusqueda } from "./lib/buscarTodas";
import {
  rerankearPorSimilitud,
  type ModelDownloadProgress,
} from "./lib/ia/similitud";
import type { Resultado, RespuestaTienda } from "./lib/tipos";

const CLAVE_MODO_IA = "masbarato:modoIA";
const EVENTO_CAMBIO_MODO_IA = "masbarato-modo-ia-change";

// Igual patrón que ThemeToggle: useSyncExternalStore evita el parpadeo de
// hidratación (el server siempre "ve" false) y, a diferencia de leerlo en
// un useEffect con setState, no dispara el lint de cascading renders.
function leerModoIA(): boolean {
  return window.localStorage.getItem(CLAVE_MODO_IA) === "1";
}

function suscribirModoIA(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(EVENTO_CAMBIO_MODO_IA, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(EVENTO_CAMBIO_MODO_IA, onStoreChange);
  };
}

function modoIAEnServidor(): boolean {
  return false;
}

function precioPorUnidadTexto(r: Resultado): string | null {
  if (r.precio === null) {
    return null;
  }
  const presentacion = r.presentacion ?? extraerPresentacion(r.nombre);
  if (!presentacion) {
    return null;
  }
  return formatearPrecioPorUnidad(calcularPrecioPorUnidad(r.precio, presentacion));
}

function Imagen({ src, clase }: { src?: string; clase: string }): React.JSX.Element {
  if (!src) {
    return (
      <span
        className={`${clase} shrink-0 rounded-md border border-dashed border-black/[.08] dark:border-white/[.145]`}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${clase} shrink-0 rounded-md border border-black/[.08] bg-white object-contain dark:border-white/[.145]`}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}

const LIMITES_DISPONIBLES = [3, 5, 10, 30] as const;

export function ComparadorPrecios(): React.JSX.Element {
  const [tiendas, setTiendas] = useState<string[]>([]);
  const [termino, setTermino] = useState<string>("");
  const [limite, setLimite] = useState<number>(3);
  const [buscando, setBuscando] = useState<boolean>(false);
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaTienda>>(
    {},
  );
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [huboBusqueda, setHuboBusqueda] = useState<boolean>(false);
  const [tiendasExcluidas, setTiendasExcluidas] = useState<Set<string>>(
    new Set(),
  );
  const [tiendasBuscadas, setTiendasBuscadas] = useState<string[]>([]);
  const [soloDisponibles, setSoloDisponibles] = useState<boolean>(true);
  const [criterioOrden, setCriterioOrden] = useState<CriterioOrden>("total");
  const [categoriasExcluidas, setCategoriasExcluidas] = useState<Set<string>>(
    new Set(),
  );
  const modoIA = useSyncExternalStore(
    suscribirModoIA,
    leerModoIA,
    modoIAEnServidor,
  );
  const [progresoModelo, setProgresoModelo] =
    useState<ModelDownloadProgress | null>(null);

  const solicitudActualRef = useRef<number>(0);

  const alternarModoIA = useCallback((valor: boolean): void => {
    window.localStorage.setItem(CLAVE_MODO_IA, valor ? "1" : "0");
    window.dispatchEvent(new Event(EVENTO_CAMBIO_MODO_IA));
  }, []);

  const alternarTienda = useCallback((tienda: string): void => {
    setTiendasExcluidas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(tienda)) {
        siguiente.delete(tienda);
      } else {
        siguiente.add(tienda);
      }
      return siguiente;
    });
  }, []);

  const seleccionarTodasLasTiendas = useCallback((): void => {
    setTiendasExcluidas(new Set());
  }, []);

  const deseleccionarTodasLasTiendas = useCallback((): void => {
    setTiendasExcluidas(new Set(tiendas));
  }, [tiendas]);

  const alternarCategoria = useCallback((categoria: string): void => {
    setCategoriasExcluidas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(categoria)) {
        siguiente.delete(categoria);
      } else {
        siguiente.add(categoria);
      }
      return siguiente;
    });
  }, []);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/masbarato/tiendas")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((datos: { tiendas: string[] }) => {
        if (!cancelado) {
          setTiendas(datos.tiendas);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setTiendas([]);
        }
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      const terminoLimpio = termino.trim();
      if (!terminoLimpio) {
        return;
      }
      const tiendasSeleccionadas = tiendas.filter(
        (t) => !tiendasExcluidas.has(t),
      );
      if (tiendas.length > 0 && tiendasSeleccionadas.length === 0) {
        return;
      }

      const idSolicitud = solicitudActualRef.current + 1;
      solicitudActualRef.current = idSolicitud;

      setBuscando(true);
      setHuboBusqueda(true);
      setErrorGeneral(null);
      setRespuestas({});
      setCategoriasExcluidas(new Set());
      setProgresoModelo(null);
      setTiendasBuscadas(
        tiendasSeleccionadas.length > 0 ? tiendasSeleccionadas : tiendas,
      );

      try {
        const respuesta = await fetch("/api/masbarato/buscar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            termino: terminoLimpio,
            limite,
            tiendas: tiendasSeleccionadas,
            modoIA,
          }),
        });

        if (respuesta.status === 401) {
          // Navegación completa: la sesión expiró en el servidor; una
          // transición cliente podría reusar el caché del router.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/masbarato/login";
          return;
        }

        if (!respuesta.ok || !respuesta.body) {
          const datos = (await respuesta.json().catch(() => null)) as {
            error?: string;
          } | null;
          setErrorGeneral(datos?.error ?? "No se pudo completar la búsqueda.");
          return;
        }

        const lector = respuesta.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await lector.read();
          if (solicitudActualRef.current !== idSolicitud) {
            // Llegó una búsqueda más nueva: se descarta esta.
            return;
          }
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          let indiceSalto = buffer.indexOf("\n");
          while (indiceSalto >= 0) {
            const linea = buffer.slice(0, indiceSalto);
            buffer = buffer.slice(indiceSalto + 1);
            if (linea.trim()) {
              const evento = JSON.parse(linea) as EventoBusqueda;
              // El servidor manda candidatos crudos (sin el filtro literal
              // de cada adaptador, ver route.ts) cuando modoIA está
              // activo; acá se recortan a `limite` re-rankeados por
              // similitud semántica, en vez de por el orden que trajo la
              // tienda. Requiere descargar el modelo la primera vez.
              const resultados =
                modoIA && evento.respuesta.resultados.length > 0
                  ? await rerankearPorSimilitud(
                      terminoLimpio,
                      evento.respuesta.resultados,
                      limite,
                      setProgresoModelo,
                    )
                  : evento.respuesta.resultados;

              if (solicitudActualRef.current !== idSolicitud) {
                return;
              }
              setRespuestas((prev) => ({
                ...prev,
                [evento.respuesta.tienda]: { ...evento.respuesta, resultados },
              }));
            }
            indiceSalto = buffer.indexOf("\n");
          }
        }
      } catch {
        if (solicitudActualRef.current === idSolicitud) {
          setErrorGeneral("No se pudo conectar con el servidor.");
        }
      } finally {
        if (solicitudActualRef.current === idSolicitud) {
          setBuscando(false);
        }
      }
    },
    [termino, limite, tiendas, tiendasExcluidas, modoIA],
  );

  const listaRespuestas = Object.values(respuestas);
  const mejor = calcularMejor(listaRespuestas);
  const seleccionVacia =
    tiendas.length > 0 && tiendas.every((t) => tiendasExcluidas.has(t));

  const todosLosResultados = listaRespuestas.flatMap((r) => r.resultados);
  const precios = todosLosResultados
    .map((r) => r.precio)
    .filter((p): p is number => p !== null);
  const stats = {
    total: todosLosResultados.length,
    minimo: precios.length > 0 ? Math.min(...precios) : null,
    maximo: precios.length > 0 ? Math.max(...precios) : null,
    agotados: todosLosResultados.filter((r) => !r.disponible).length,
  };
  const erroresPorTienda = listaRespuestas.filter(
    (r): r is RespuestaTienda & { error: string } => Boolean(r.error),
  );

  // Cada tienda reporta categoría con su propia taxonomía (no hay una
  // homologada entre todas), así que la lista de opciones sale de lo que
  // efectivamente trajo esta búsqueda, no de un catálogo fijo. Los
  // resultados sin categoría (ej. Farmavida, que no la expone) no tienen
  // checkbox propio y nunca se ocultan por este filtro.
  const categoriasDisponibles = Array.from(
    new Set(
      todosLosResultados
        .map((r) => r.categoria)
        .filter((c): c is string => Boolean(c)),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const filas = ordenarPorPrecio(
    todosLosResultados.filter(
      (r) =>
        (!soloDisponibles || r.disponible) &&
        (!r.categoria || !categoriasExcluidas.has(r.categoria)),
    ),
    criterioOrden,
  );

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-black/[.08] p-5 lg:w-72 lg:shrink-0 dark:border-white/[.145]"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="termino"
            className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
          >
            Producto
          </label>
          <div className="relative">
            <input
              id="termino"
              type="text"
              placeholder="ej. acetaminofén 500"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              className="h-11 w-full rounded-lg border border-black/[.08] bg-transparent px-3 pr-9 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
            />
            {termino && (
              <button
                type="button"
                onClick={() => setTermino("")}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-black/[.06] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/[.08] dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Resultados por tienda
          </span>
          <div className="flex rounded-lg border border-black/[.08] p-1 dark:border-white/[.145]">
            {LIMITES_DISPONIBLES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLimite(l)}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  limite === l
                    ? "bg-foreground text-background"
                    : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Búsqueda mejorada con IA{" "}
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                (beta)
              </span>
            </span>
            <input
              type="checkbox"
              checked={modoIA}
              onChange={(e) => alternarModoIA(e.target.checked)}
              className="h-4 w-4 rounded border-black/[.2] accent-amber-500 dark:border-white/[.3]"
            />
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Compara el significado del nombre del producto, no solo el
            texto exacto — encuentra más coincidencias, pero corre un
            modelo en tu navegador (descarga ~120 MB la primera vez, luego
            queda en caché) y hace la búsqueda más lenta.
          </p>
        </div>

        <button
          type="submit"
          disabled={buscando || !termino.trim() || seleccionVacia}
          className="flex h-11 items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {buscando ? "Comparando..." : "Comparar"}
        </button>

        {modoIA && progresoModelo && (
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/[.08] dark:bg-white/[.145]">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${progresoModelo.percentage}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Descargando modelo de IA — {progresoModelo.file}:{" "}
              {progresoModelo.percentage}%
            </span>
          </div>
        )}

        {tiendas.length > 0 && (
          <>
            <div className="h-px bg-black/[.08] dark:bg-white/[.145]" />
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-medium tracking-wide text-zinc-500 uppercase [&::-webkit-details-marker]:hidden dark:text-zinc-400">
                <span>
                  Tiendas · {tiendas.length - tiendasExcluidas.size} de{" "}
                  {tiendas.length}
                </span>
                <span className="text-zinc-400 transition-transform group-open:rotate-180 dark:text-zinc-500">
                  ▾
                </span>
              </summary>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={seleccionarTodasLasTiendas}
                  className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={deseleccionarTodasLasTiendas}
                  className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  Ninguna
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {tiendas.map((tienda) => (
                  <label
                    key={tienda}
                    className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <input
                      type="checkbox"
                      checked={!tiendasExcluidas.has(tienda)}
                      onChange={() => alternarTienda(tienda)}
                      className="h-4 w-4 rounded border-black/[.2] accent-amber-500 dark:border-white/[.3]"
                    />
                    {tienda}
                  </label>
                ))}
              </div>
            </details>
          </>
        )}

        {seleccionVacia && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Selecciona al menos una tienda para poder comparar.
          </p>
        )}
      </form>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {errorGeneral && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorGeneral}
          </p>
        )}

        {huboBusqueda && (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-black/[.08] bg-black/[.08] sm:grid-cols-4 dark:border-white/[.145] dark:bg-white/[.145]">
              <div className="flex flex-col gap-1 bg-zinc-50 px-4 py-3 dark:bg-black">
                <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Resultados
                </span>
                <span className="text-xl font-semibold text-black dark:text-zinc-50">
                  {stats.total}
                </span>
              </div>
              <div className="flex flex-col gap-1 bg-zinc-50 px-4 py-3 dark:bg-black">
                <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Precio mínimo
                </span>
                <span className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                  {formatearPrecio(stats.minimo)}
                </span>
              </div>
              <div className="flex flex-col gap-1 bg-zinc-50 px-4 py-3 dark:bg-black">
                <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Precio máximo
                </span>
                <span className="text-xl font-semibold text-black dark:text-zinc-50">
                  {formatearPrecio(stats.maximo)}
                </span>
              </div>
              <div className="flex flex-col gap-1 bg-zinc-50 px-4 py-3 dark:bg-black">
                <span className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Agotados
                </span>
                <span className="text-xl font-semibold text-black dark:text-zinc-50">
                  {stats.agotados}
                </span>
              </div>
            </div>

            {buscando && (
              <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span
                  role="status"
                  className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black/60 dark:border-white/20 dark:border-t-white/60"
                />
                Comparando en {tiendasBuscadas.length} tiendas... (
                {Object.keys(respuestas).length}/{tiendasBuscadas.length})
              </p>
            )}

            {erroresPorTienda.length > 0 && (
              <div className="flex flex-col gap-1 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                {erroresPorTienda.map((r) => (
                  <p key={r.tienda}>
                    ⚠ {r.tienda}: {r.error}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={soloDisponibles}
                  onChange={(e) => setSoloDisponibles(e.target.checked)}
                  className="h-4 w-4 rounded border-black/[.2] accent-amber-500 dark:border-white/[.3]"
                />
                Solo disponibles
              </label>

              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Ordenar por
                </span>
                <div className="flex rounded-lg border border-black/[.08] p-1 dark:border-white/[.145]">
                  {(
                    [
                      { valor: "total", etiqueta: "Precio total" },
                      { valor: "unidad", etiqueta: "Precio por unidad" },
                    ] as const
                  ).map((opcion) => (
                    <button
                      key={opcion.valor}
                      type="button"
                      onClick={() => setCriterioOrden(opcion.valor)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        criterioOrden === opcion.valor
                          ? "bg-foreground text-background"
                          : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
                      }`}
                    >
                      {opcion.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {categoriasDisponibles.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                  Categoría (según cada tienda)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {categoriasDisponibles.map((categoria) => {
                    const activa = !categoriasExcluidas.has(categoria);
                    return (
                      <button
                        key={categoria}
                        type="button"
                        onClick={() => alternarCategoria(categoria)}
                        aria-pressed={activa}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          activa
                            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                            : "border-black/[.08] text-zinc-400 line-through dark:border-white/[.145] dark:text-zinc-500"
                        }`}
                      >
                        {categoria}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filas.length === 0 && !buscando && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sin resultados.
              </p>
            )}

            {filas.length > 0 && (
              <>
                <div className="hidden overflow-x-auto rounded-2xl border border-black/[.08] lg:block dark:border-white/[.145]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/[.08] text-left text-[11px] tracking-wide text-zinc-500 uppercase dark:border-white/[.145] dark:text-zinc-400">
                        <th className="w-10 py-2 pl-4 font-medium">#</th>
                        <th className="py-2 px-3 font-medium">Producto</th>
                        <th className="w-28 py-2 px-3 font-medium">
                          Presentación
                        </th>
                        <th className="w-28 py-2 px-3 text-right font-medium">
                          Precio
                        </th>
                        <th className="w-28 py-2 px-3 text-right font-medium">
                          Por unidad
                        </th>
                        <th className="w-24 py-2 px-3 font-medium">Estado</th>
                        <th className="w-10 py-2 pr-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((r, i) => {
                        const presentacion =
                          r.presentacion ?? extraerPresentacion(r.nombre);
                        return (
                          <tr
                            key={`${r.tienda}-${r.nombre}-${i}`}
                            className={`border-b border-black/[.06] last:border-0 dark:border-white/[.08] ${
                              i === 0 ? "bg-amber-50 dark:bg-amber-950/30" : ""
                            }`}
                          >
                            <td className="py-2.5 pl-4 text-xs text-zinc-500 dark:text-zinc-400">
                              {i + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-3">
                                <Imagen src={r.imagen} clase="h-9 w-9" />
                                <div className="min-w-0">
                                  <div className="wrap-break-word font-medium text-black dark:text-zinc-50">
                                    {r.nombre}
                                  </div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {r.tienda}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                              {presentacion
                                ? formatearPresentacion(presentacion)
                                : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-black dark:text-zinc-50">
                              {formatearPrecio(r.precio)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-zinc-400">
                              {precioPorUnidadTexto(r) ?? "—"}
                            </td>
                            <td
                              className={`py-2.5 px-3 ${
                                r.disponible
                                  ? "text-black dark:text-zinc-50"
                                  : "text-zinc-500 dark:text-zinc-400"
                              }`}
                            >
                              {r.disponible ? "En stock" : "Agotado"}
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              {r.url && (
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="text-xs text-amber-700 hover:underline dark:text-amber-400"
                                >
                                  Ver →
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="flex flex-col gap-2 lg:hidden">
                  {filas.map((r, i) => {
                    const Elemento = r.url ? "a" : "div";
                    const detalle = [
                      r.tienda,
                      precioPorUnidadTexto(r),
                      !r.disponible ? "agotado" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li key={`${r.tienda}-${r.nombre}-${i}`}>
                        <Elemento
                          {...(r.url
                            ? {
                                href: r.url,
                                target: "_blank",
                                rel: "noreferrer noopener",
                              }
                            : {})}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                            i === 0
                              ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                              : "border-black/[.08] dark:border-white/[.145]"
                          }`}
                        >
                          <span className="w-4 shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                            {i + 1}
                          </span>
                          <Imagen src={r.imagen} clase="h-12 w-12" />
                          <div className="min-w-0 flex-1">
                            <div className="wrap-break-word font-medium text-black dark:text-zinc-50">
                              {r.nombre}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {detalle}
                            </div>
                          </div>
                          <span className="shrink-0 font-semibold text-black dark:text-zinc-50">
                            {formatearPrecio(r.precio)}
                          </span>
                        </Elemento>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}

        {mejor && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              ★ Más barato: {formatearPrecio(mejor.precio)}
              {precioPorUnidadTexto(mejor) && ` (${precioPorUnidadTexto(mejor)})`}{" "}
              en {mejor.tienda}
            </p>
            {mejor.url && (
              <a
                href={mejor.url}
                target="_blank"
                rel="noreferrer noopener"
                className="block break-all text-sm text-amber-700 underline dark:text-amber-300"
              >
                {mejor.url}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
