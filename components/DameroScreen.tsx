/**
 * Armazón compartido por el damero del día y el de práctica: cabecera,
 * instrucciones plegables y el tablero.
 */

import { DameroBoard } from "./DameroBoard.tsx";
import type { Damero } from "@/lib/types.ts";

export function DameroScreen({ damero, subtitle }: { damero: Damero; subtitle: string }) {
  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Damero</h1>
        <p className="mt-0.5 text-sm text-ink-soft first-letter:uppercase">{subtitle}</p>
      </header>

      <details className="mb-6 rounded-md border border-rule bg-card p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Cómo se juega</summary>
        <div className="mt-2 space-y-2 text-ink-soft">
          <p>
            La cuadrícula esconde una frase célebre, escrita de izquierda a derecha y de
            arriba abajo. Las casillas negras separan sus palabras.
          </p>
          <p>
            Cada clave es una palabra suelta. Sus letras no van seguidas en la cuadrícula:
            van a las casillas que indican sus coordenadas, repartidas por todo el damero.
            En cada casilla, arriba a la izquierda, verás a qué clave pertenece.
          </p>
          <p>
            Puedes escribir en la cuadrícula o en las casillas de las claves: es lo mismo.
            Y cuando lo resuelvas, las iniciales de las respuestas, leídas en orden, te
            darán el autor y la obra.
          </p>
        </div>
      </details>

      <DameroBoard damero={damero} />
    </>
  );
}

/** Lo que se ve mientras el servidor arma el damero y escribe las definiciones. */
export function DameroSkeleton() {
  return (
    <div className="py-20 text-center">
      <p className="text-sm text-ink-soft">Componiendo el damero…</p>
      <p className="mt-1 text-xs text-ink-soft">
        La primera visita del día escribe las definiciones; las siguientes son inmediatas.
      </p>
    </div>
  );
}
