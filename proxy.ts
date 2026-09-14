import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  NOMBRE_COOKIE_SESION,
  verificarTokenSesion,
} from "./app/farmacia/lib/autenticacion";

export function proxy(request: NextRequest): NextResponse {
  const secreto = process.env.FARMACIA_SESSION_SECRET;
  const token = request.cookies.get(NOMBRE_COOKIE_SESION)?.value;
  const autenticado = secreto ? verificarTokenSesion(token, secreto) : false;

  if (autenticado) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/farmacia")) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/farmacia/login", request.url));
}

export const config = {
  matcher: [
    "/farmacia",
    "/farmacia/((?!login).*)",
    "/api/farmacia/((?!login|logout|diagnostico).*)",
  ],
};
