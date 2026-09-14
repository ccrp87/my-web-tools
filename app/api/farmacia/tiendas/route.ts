import { NextResponse } from "next/server";
import { TIENDAS } from "@/app/farmacia/lib/adaptadores/tiendas";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ tiendas: TIENDAS.map((t) => t.tienda) });
}
