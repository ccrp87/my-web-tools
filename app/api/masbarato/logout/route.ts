import { NextResponse } from "next/server";
import { NOMBRE_COOKIE_SESION } from "@/app/masbarato/lib/autenticacion";

export async function POST(): Promise<NextResponse> {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.delete(NOMBRE_COOKIE_SESION);
  return respuesta;
}
