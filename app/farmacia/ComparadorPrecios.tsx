"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { formatearPrecio } from "./lib/precio";
import { calcularMejor } from "./lib/resultados";
import type { EventoBusqueda } from "./lib/buscarTodas";
import type { RespuestaTienda } from "./lib/tipos";

const LIMITES_DISPONIBLES = [3, 5, 10] as const;

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

  const solicitudActualRef = useRef<number>(0);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/farmacia/tiendas")
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

      const idSolicitud = solicitudActualRef.current + 1;
      solicitudActualRef.current = idSolicitud;

      setBuscando(true);
      setHuboBusqueda(true);
      setErrorGeneral(null);
      setRespuestas({});

      try {
        const respuesta = await fetch("/api/farmacia/buscar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ termino: terminoLimpio, limite }),
        });

        if (respuesta.status === 401) {
          // Navegación completa: la sesión expiró en el servidor; una
          // transición cliente podría reusar el caché del router.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/farmacia/login";
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
              setRespuestas((prev) => ({
                ...prev,
                [evento.respuesta.tienda]: evento.respuesta,
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
    [termino, limite],
  );

  const listaRespuestas = Object.values(respuestas);
  const mejor = calcularMejor(listaRespuestas);
  const nombresTiendas = tiendas.length > 0 ? tiendas : Object.keys(respuestas);

  return (
    <div className="flex w-full flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 sm:flex-row"
      >
        <input
          type="text"
          placeholder="Qué medicamento buscas (ej. acetaminofén 500)"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          className="h-12 rounded-full border border-black/[.08] bg-transparent px-5 text-sm text-black outline-none focus:border-black/40 sm:flex-1 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
        />
        <select
          value={limite}
          onChange={(e) => setLimite(Number(e.target.value))}
          className="h-12 rounded-full border border-black/[.08] bg-transparent px-4 text-sm text-black outline-none dark:border-white/[.145] dark:text-zinc-50"
        >
          {LIMITES_DISPONIBLES.map((l) => (
            <option key={l} value={l}>
              {l} resultados por tienda
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={buscando || !termino.trim()}
          className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {buscando ? "Comparando..." : "Comparar"}
        </button>
      </form>

      {errorGeneral && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errorGeneral}
        </p>
      )}

      {huboBusqueda && (
        <div className="flex flex-col gap-4">
          {nombresTiendas.map((tienda) => {
            const resp = respuestas[tienda];
            const cargandoTienda = buscando && !resp;

            return (
              <div
                key={tienda}
                className="flex flex-col gap-2 rounded-2xl border border-black/[.08] px-5 py-4 dark:border-white/[.145]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-black dark:text-zinc-50">
                    {tienda}
                  </span>
                  {cargandoTienda && (
                    <span
                      role="status"
                      aria-label={`Buscando en ${tienda}`}
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black/60 dark:border-white/20 dark:border-t-white/60"
                    />
                  )}
                </div>

                {resp?.error && (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    ⚠ {resp.error}
                  </p>
                )}

                {resp && !resp.error && resp.resultados.length === 0 && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Sin resultados.
                  </p>
                )}

                {resp && !resp.error && resp.resultados.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {resp.resultados.map((r, i) => {
                      const esMejor = mejor !== null && r === mejor;
                      const Elemento = r.url ? "a" : "div";
                      return (
                        <li key={`${r.nombre}-${i}`}>
                          <Elemento
                            {...(r.url
                              ? {
                                  href: r.url,
                                  target: "_blank",
                                  rel: "noreferrer noopener",
                                }
                              : {})}
                            className={`flex items-start gap-2 rounded-lg p-1.5 text-sm sm:items-center sm:gap-3 ${
                              r.url
                                ? "hover:bg-black/[.03] dark:hover:bg-white/[.06]"
                                : ""
                            }`}
                          >
                            <span className="w-4 shrink-0 pt-0.5 text-center text-amber-500 sm:pt-0">
                              {esMejor ? "★" : ""}
                            </span>
                            {r.imagen ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.imagen}
                                alt=""
                                loading="lazy"
                                className="h-10 w-10 shrink-0 rounded-md border border-black/[.08] object-contain bg-white sm:h-12 sm:w-12 dark:border-white/[.145]"
                                onError={(e) => {
                                  e.currentTarget.style.visibility = "hidden";
                                }}
                              />
                            ) : (
                              <span className="h-10 w-10 shrink-0 rounded-md border border-dashed border-black/[.08] sm:h-12 sm:w-12 dark:border-white/[.145]" />
                            )}
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                              <span className="shrink-0 font-medium text-black dark:text-zinc-50 sm:w-24">
                                {formatearPrecio(r.precio)}
                              </span>
                              <span className="min-w-0 wrap-break-word text-zinc-700 dark:text-zinc-300">
                                {r.nombre}
                                {!r.disponible && (
                                  <span className="text-zinc-500 dark:text-zinc-400">
                                    {" "}
                                    (agotado)
                                  </span>
                                )}
                              </span>
                            </span>
                          </Elemento>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mejor && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            ★ Más barato: {formatearPrecio(mejor.precio)} en {mejor.tienda}
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
  );
}
