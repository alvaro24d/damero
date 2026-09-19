"use client";

/**
 * La cuadrícula de la frase.
 *
 * Cada casilla blanca lleva, arriba a la izquierda, la etiqueta de la clave a
 * la que pertenece. Es lo que hace jugable el damero en las dos direcciones:
 * con las coordenadas de la clave rellenas la cuadrícula, y con la etiqueta de
 * la casilla sabes a qué definición llevar una letra que has adivinado leyendo
 * la frase.
 *
 * La retícula puede tener 21 columnas, que en un móvil no caben a un tamaño
 * legible, así que se desplaza en horizontal en vez de encogerse hasta que las
 * letras no se lean.
 */

import type { Selection } from "./DameroBoard.tsx";
import { rowLabel, type Entry, type Grid } from "@/lib/types.ts";

interface Props {
  grid: Grid;
  entries: Entry[];
  letters: string[];
  owner: Map<number, Selection>;
  selected: Selection | null;
  currentCell: number | null;
  checking: boolean;
  revealed: Set<number>;
  onSelectCell: (cell: number) => void;
}

export function DameroGrid({
  grid,
  entries,
  letters,
  owner,
  selected,
  currentCell,
  checking,
  revealed,
  onSelectCell,
}: Props) {
  const columns = Array.from({ length: grid.width }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <div className="w-max min-w-full">
        {/* Cabecera de columnas */}
        <div className="flex">
          <div className="w-6 shrink-0" />
          {columns.map((column) => (
            <div
              key={column}
              className="w-7 shrink-0 pb-1 text-center font-mono text-[10px] text-ink-soft sm:w-8"
            >
              {column}
            </div>
          ))}
        </div>

        {Array.from({ length: grid.height }, (_, row) => (
          <div key={row} className="flex">
            <div className="flex w-6 shrink-0 items-center justify-center pr-1 font-mono text-[10px] text-ink-soft">
              {rowLabel(row)}
            </div>

            {Array.from({ length: grid.width }, (_, column) => {
              const cell = row * grid.width + column;

              if (grid.blocks[cell]) {
                return (
                  <div
                    key={cell}
                    aria-hidden
                    className="h-7 w-7 shrink-0 border border-rule bg-block sm:h-8 sm:w-8"
                  />
                );
              }

              const target = owner.get(cell);
              const inSelectedEntry = selected !== null && target?.entry === selected.entry;
              const isCurrent = cell === currentCell;
              const letter = letters[cell] ?? "";
              const wrong = checking && letter !== "" && letter !== grid.solution[cell];

              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => onSelectCell(cell)}
                  aria-label={`Casilla ${rowLabel(row)}-${column + 1}, clave ${
                    target ? entries[target.entry].label : "?"
                  }`}
                  className={[
                    "relative h-7 w-7 shrink-0 border border-rule text-center font-semibold",
                    "text-[13px] leading-7 sm:h-8 sm:w-8 sm:text-[15px] sm:leading-8",
                    "transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ink",
                    isCurrent
                      ? "bg-active"
                      : inSelectedEntry
                        ? "bg-active-soft"
                        : "bg-card hover:bg-active-soft",
                    wrong ? "text-error line-through" : "",
                    revealed.has(cell) && !wrong ? "text-ink-soft" : "",
                  ].join(" ")}
                >
                  <span className="pointer-events-none absolute top-px left-px font-mono text-[7px] leading-none font-normal text-ink-soft sm:text-[8px]">
                    {target ? entries[target.entry].label : ""}
                  </span>
                  {letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
