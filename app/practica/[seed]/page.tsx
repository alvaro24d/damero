import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DameroScreen, DameroSkeleton } from "@/components/DameroScreen.tsx";
import { getPracticeDamero } from "@/lib/daily.ts";

type Params = PageProps<"/practica/[seed]">["params"];

// `params` se resuelve dentro del Suspense, no aquí: así Next puede enviar el
// armazón de la página mientras el servidor compone el damero.
export default function Page({ params }: PageProps<"/practica/[seed]">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Suspense fallback={<DameroSkeleton />}>
        <DameroDePractica params={params} />
      </Suspense>
    </main>
  );
}

async function DameroDePractica({ params }: { params: Params }) {
  const { seed } = await params;
  const value = Number(seed);
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) notFound();

  const damero = await getPracticeDamero(value);
  return <DameroScreen damero={damero} subtitle={`damero de práctica nº ${value}`} />;
}
