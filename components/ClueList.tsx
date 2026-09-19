"use client";

/**
 * Las claves, a dos columnas como en el periódico.
 *
 * Cada una lleva sus casillas para escribir la respuesta y, debajo, las
 * coordenadas de sus letras en la cuadrícula. Escribir aquí es lo mismo que
 * escribir en la retícula: las casillas son las mismas.
 */

import type { Selection } from "./DameroBoard.tsx";
import type { Entry } from "@/lib/types.ts";

interface Props {
  entries: Entry[];
  letters: string[];
  selected: Selection | null;
  checking: boolean;
  revealed: Set<number>;
  solution: string[];
  onSelect: (selection: Selection) => void;
}

export function ClueList({
  entries,
  letters,
  selected,
  checking,
  revealed,
  solution,
  onSelect,
}: Props) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-widest uppercase">Claves</h2>

      <ol className="grid gap-4 md:grid-cols-2 md:gap-x-8">
        {entries.map((entry, index) => {
          const active = selected?.entry === index;

          return (
            <li
              key={entry.label}
              className={[
                "rounded-md border p-3 transition-colors",
                active ? "border-ink bg-active-soft" : "border-rule bg-card",
              ].join(" ")}
            >
              <div className="flex gap-3">
                <span className="w-6 shrink-0 pt-px text-right font-mono text-sm font-bold">
                  {entry.label}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-snug">{entry.clue}</p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.cells.map((cell, position) => {
                      const letter = letters[cell] ?? "";
                      const wrong = checking && letter !== "" && letter !== solution[cell];
                      const current =
                        active && selected?.position === position;

                      return (
                        <button
                          key={cell}
                          type="button"
                          onClick={() => onSelect({ entry: index, position })}
                          aria-label={`${entry.label}, letra ${position + 1}, casilla ${entry.coords[position]}`}
                          className={[
                            "h-7 w-6 border border-rule text-center text-sm font-semibold",
                            "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink",
                            current ? "bg-active" : "bg-card hover:bg-active-soft",
                            wrong ? "text-error line-through" : "",
                            revealed.has(cell) && !wrong ? "text-ink-soft" : "",
                          ].join(" ")}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-soft">
                    {entry.coords.join(" ")}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
