import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  NOMBRE_COOKIE_SESION,
  verificarTokenSesion,
} from "@/app/farmacia/lib/autenticacion";
import { crearFlujoBusqueda } from "@/app/farmacia/lib/buscarTodas";
import { crearCache } from "@/app/farmacia/lib/cache";
import type { RespuestaTienda } from "@/app/farmacia/lib/tipos";

const LIMITE_POR_DEFECTO = 3;
const LIMITE_MAXIMO = 10;

// Módulo cargado una vez por proceso: la caché vive mientras viva el
// servidor, igual que el registro de tiendas.
const cacheBusquedas = crearCache<RespuestaTienda>();

interface CuerpoBusqueda {
  termino?: string;
  limite?: number;
}

export async function POST(request: Request): Promise<NextResponse> {
  // El proxy ya filtra el acceso, pero una ruta que dispara tráfico externo
  // hacia las tiendas se verifica también aquí, por si el proxy cambia de
  // matcher en el futuro y deja de cubrirla.
  const secreto = process.env.FARMACIA_SESSION_SECRET;
  const token = (await cookies()).get(NOMBRE_COOKIE_SESION)?.value;
  if (!secreto || !verificarTokenSesion(token, secreto)) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  let cuerpo: CuerpoBusqueda;
  try {
    cuerpo = (await request.json()) as CuerpoBusqueda;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const termino = cuerpo.termino?.trim();
  if (!termino) {
    return NextResponse.json(
      { error: "Falta el término de búsqueda." },
      { status: 400 },
    );
  }

  const limite = Math.min(
    Math.max(1, cuerpo.limite ?? LIMITE_POR_DEFECTO),
    LIMITE_MAXIMO,
  );

  const flujo = crearFlujoBusqueda(termino, limite, cacheBusquedas);
  return new NextResponse(flujo, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
