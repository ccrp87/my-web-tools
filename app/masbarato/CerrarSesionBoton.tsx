"use client";

import { useCallback, useState } from "react";

export function CerrarSesionBoton(): React.JSX.Element {
  const [cerrando, setCerrando] = useState<boolean>(false);

  const handleClick = useCallback(async (): Promise<void> => {
    setCerrando(true);
    try {
      await fetch("/api/masbarato/logout", { method: "POST" });
    } finally {
      // Navegación completa: la cookie recién borrada debe llegar a una
      // petición nueva evaluada por el proxy, no a una transición cliente.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/masbarato/login";
    }
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={cerrando}
      className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline disabled:opacity-50 dark:text-zinc-400"
    >
      Cerrar sesión
    </button>
  );
}
