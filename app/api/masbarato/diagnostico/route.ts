import { NextResponse } from "next/server";

// Endpoint temporal de diagnóstico: NO expone valores, solo si cada
// variable llega definida al runtime que atiende la petición. Bórrese
// junto con su excepción en proxy.ts una vez resuelto el problema.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    tieneUsuario: Boolean(process.env.FARMACIA_USER),
    tieneHash: Boolean(process.env.FARMACIA_PASSWORD_HASH),
    tieneSecreto: Boolean(process.env.FARMACIA_SESSION_SECRET),
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  });
}
