import { Suspense } from "react";
import { connection } from "next/server";

import { DameroScreen, DameroSkeleton } from "@/components/DameroScreen.tsx";
import { getDailyDamero } from "@/lib/daily.ts";
import { dailyKey, formatDayKey } from "@/lib/seed.ts";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Suspense fallback={<DameroSkeleton />}>
        <DameroDelDia />
      </Suspense>
    </main>
  );
}

async function DameroDelDia() {
  // `dailyKey()` mira el reloj, así que sin esto Next lo resolvería al compilar
  // y el damero se quedaría congelado en la fecha del despliegue.
  await connection();

  const key = dailyKey();
  const damero = await getDailyDamero(key);

  return <DameroScreen damero={damero} subtitle={formatDayKey(key)} />;
}
