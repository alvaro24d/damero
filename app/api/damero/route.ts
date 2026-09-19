/**
 * El damero en JSON, por si quieres montarte otra interfaz encima o mirar la
 * solución desde la consola.
 *
 *   GET /api/damero            -> el del día
 *   GET /api/damero?seed=1234  -> uno de práctica, reproducible
 */

import { NextResponse, type NextRequest } from "next/server";

import { getDailyDamero, getPracticeDamero } from "@/lib/daily.ts";
import { dailyKey } from "@/lib/seed.ts";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("seed");

  if (raw === null) {
    return NextResponse.json(await getDailyDamero(dailyKey()));
  }

  const seed = Number(raw);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    return NextResponse.json(
      { error: "La semilla tiene que ser un entero entre 0 y 4294967295." },
      { status: 400 },
    );
  }

  return NextResponse.json(await getPracticeDamero(seed));
}
