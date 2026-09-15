import { NextResponse } from "next/server";
import {
  crearTokenSesion,
  DURACION_SESION_MS,
  NOMBRE_COOKIE_SESION,
  verificarClave,
} from "@/app/masbarato/lib/autenticacion";

interface CuerpoLogin {
  usuario?: string;
  clave?: string;
}

const MENSAJE_INCORRECTO = "Usuario o contraseña incorrectos.";

export async function POST(request: Request): Promise<NextResponse> {
  const usuarioEsperado = process.env.FARMACIA_USER;
  const hashEsperado = process.env.FARMACIA_PASSWORD_HASH;
  const secreto = process.env.FARMACIA_SESSION_SECRET;

  if (!usuarioEsperado || !hashEsperado || !secreto) {
    return NextResponse.json(
      {
        error:
          "La herramienta no está configurada: faltan variables de entorno.",
      },
      { status: 500 },
    );
  }

  let cuerpo: CuerpoLogin;
  try {
    cuerpo = (await request.json()) as CuerpoLogin;
  } catch {
    return NextResponse.json({ error: MENSAJE_INCORRECTO }, { status: 400 });
  }

  const usuarioValido = cuerpo.usuario === usuarioEsperado;
  const claveValida =
    typeof cuerpo.clave === "string" && verificarClave(cuerpo.clave, hashEsperado);

  if (!usuarioValido || !claveValida) {
    return NextResponse.json({ error: MENSAJE_INCORRECTO }, { status: 401 });
  }

  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set(NOMBRE_COOKIE_SESION, crearTokenSesion(secreto), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DURACION_SESION_MS / 1000),
  });
  return respuesta;
}
