import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  NOMBRE_COOKIE_SESION,
  verificarTokenSesion,
} from "@/app/masbarato/lib/autenticacion";
import { TIENDAS } from "@/app/masbarato/lib/adaptadores/tiendas";
import { crearFlujoBusqueda } from "@/app/masbarato/lib/buscarTodas";
import { crearCache } from "@/app/masbarato/lib/cache";
import type { RespuestaTienda } from "@/app/masbarato/lib/tipos";

const LIMITE_POR_DEFECTO = 3;
const LIMITE_MAXIMO = 30;
// El modo IA re-rankea del lado del cliente por similitud semántica, así
// que necesita más candidatos crudos que los que se van a mostrar — si se
// pidieran exactamente los mismos que se muestran, no quedaría margen para
// descartar nada sin reducir la cuenta final (el filtro perdería su
// propósito). Se pide el doble de lo que el usuario eligió mostrar, con un
// piso de 20 y un techo de 50 (ya es el lote que VTEX/Farmatodo/Alkosto
// manejan internamente de por sí, ver esos adaptadores). Cruz Verde nunca
// da más de 10 sin importar esto (`LIMITE_MAXIMO_SUGERENCIAS` en
// cruzverde.ts): pedir un lote más grande ahí solo implicaría más
// llamadas HTTP (una por imagen de candidato) sin traer más resultados.
const LIMITE_CANDIDATOS_IA_MAXIMO = 50;
const LIMITE_CANDIDATOS_IA_MINIMO = 20;

// Módulo cargado una vez por proceso: la caché vive mientras viva el
// servidor, igual que el registro de tiendas.
const cacheBusquedas = crearCache<RespuestaTienda>();

interface CuerpoBusqueda {
  termino?: string;
  limite?: number;
  tiendas?: string[];
  // Búsqueda mejorada con IA (opt-in, ver ComparadorPrecios.tsx): cuando es
  // true, cada adaptador se salta su filtro local de coincidencia literal
  // (`crudo`) y aquí se pide un lote más grande de candidatos, porque el
  // filtrado final por similitud semántica ocurre en el cliente.
  modoIA?: boolean;
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

  const modoIA = cuerpo.modoIA === true;
  const limiteMostrar = Math.min(
    Math.max(1, cuerpo.limite ?? LIMITE_POR_DEFECTO),
    LIMITE_MAXIMO,
  );
  const limite = modoIA
    ? Math.min(
        Math.max(limiteMostrar * 2, LIMITE_CANDIDATOS_IA_MINIMO),
        LIMITE_CANDIDATOS_IA_MAXIMO,
      )
    : limiteMostrar;

  // Nombres desconocidos se ignoran en vez de fallar la búsqueda entera:
  // el filtro es una preferencia de la UI, no una validación estricta.
  const nombresPedidos = Array.isArray(cuerpo.tiendas) ? cuerpo.tiendas : [];
  const tiendasFiltradas =
    nombresPedidos.length > 0
      ? TIENDAS.filter((a) => nombresPedidos.includes(a.tienda))
      : TIENDAS;

  if (tiendasFiltradas.length === 0) {
    return NextResponse.json(
      { error: "No se seleccionó ninguna tienda válida." },
      { status: 400 },
    );
  }

  const flujo = crearFlujoBusqueda(termino, limite, cacheBusquedas, tiendasFiltradas, {
    crudo: modoIA,
  });
  return new NextResponse(flujo, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
