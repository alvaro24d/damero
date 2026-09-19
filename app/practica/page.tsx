import { redirect } from "next/navigation";
import { connection } from "next/server";

import { randomSeed } from "@/lib/seed.ts";

/**
 * Entrada al modo práctica: sortea una semilla y manda a su URL, para que el
 * damero tenga dirección propia y se pueda retomar o compartir.
 */

export default async function Page() {
  await connection();
  redirect(`/practica/${randomSeed()}`);
}
