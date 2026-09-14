"use client";

import { useCallback, useState } from "react";
import type { FormEvent } from "react";

export function LoginForm(): React.JSX.Element {
  const [usuario, setUsuario] = useState<string>("");
  const [clave, setClave] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<boolean>(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setEnviando(true);
      setError(null);

      try {
        const respuesta = await fetch("/api/farmacia/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario, clave }),
        });

        if (!respuesta.ok) {
          const datos = (await respuesta.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(datos?.error ?? "Usuario o contraseña incorrectos.");
          setEnviando(false);
          return;
        }

        // Navegación completa (no router.push): la cookie de sesión recién
        // puesta debe llegar a una petición nueva evaluada por el proxy, no
        // a una transición cliente que puede reutilizar el caché del router.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/farmacia";
      } catch {
        setError("No se pudo conectar con el servidor. Intenta de nuevo.");
        setEnviando(false);
      }
    },
    [usuario, clave],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-black/[.08] px-6 py-8 dark:border-white/[.145]"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="usuario"
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Usuario
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          required
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="clave"
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          Contraseña
        </label>
        <input
          id="clave"
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-black outline-none focus:border-black/40 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {enviando ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
