"use client";

/**
 * El damero jugable: estado de las letras, selección y ayudas.
 *
 * Dos decisiones que explican casi todo el componente:
 *
 * - EL TECLADO SE ESCUCHA EN LA VENTANA, no en un campo enfocado. Las casillas
 *   son botones, y tras un clic real el foco se queda en el botón o vuelve al
 *   documento; atarse al foco dejaba el tablero mudo. Hay además una caja de
 *   texto oculta que se enfoca al seleccionar: solo sirve para que el teclado
 *   del móvil aparezca y para recoger lo que escriben los teclados virtuales,
 *   que no siempre emiten `keydown`.
 * - LA LETRA VIVE EN LA CASILLA, no en la respuesta. Una casilla de la frase
 *   pertenece a una única definición, así que escribir en la cuadrícula y
 *   escribir en la clave son la misma operación sobre el mismo dato, y ambas
 *   vistas quedan sincronizadas sin esfuerzo.
 *
 * La solución viaja al navegador para poder comprobar y revelar sin ir al
 * servidor. Es un pasatiempo de uso personal: quien mire el HTML se estropea
 * el juego a sí mismo y a nadie más.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ClueList } from "./ClueList.tsx";
import { DameroGrid } from "./DameroGrid.tsx";
import { Toolbar } from "./Toolbar.tsx";
import type { Damero } from "@/lib/types.ts";

export interface Selection {
  entry: number;
  position: number;
}

const LETTERS = /^[A-ZÑ]$/;

/** Tildes fuera y mayúscula: lo que se escribe en una casilla. */
function normalizeKey(raw: string): string | null {
  const map: Record<string, string> = {
    Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U",
  };
  const ch = raw.toUpperCase();
  const letter = map[ch] ?? ch;
  return LETTERS.test(letter) ? letter : null;
}

function storageKey(id: string): string {
  return `damero:${id}`;
}

/** Lo que se guarda de una partida. `id` dice de qué damero es lo cargado. */
interface Progress {
  id: string | null;
  letters: string[];
  revealed: Set<number>;
}

function emptyProgress(id: string | null, size: number): Progress {
  return { id, letters: new Array(size).fill(""), revealed: new Set() };
}

function readProgress(id: string, size: number): Progress {
  try {
    const saved = localStorage.getItem(storageKey(id));
    if (!saved) return emptyProgress(id, size);
    const parsed = JSON.parse(saved) as { letters?: unknown; revealed?: unknown };
    return {
      id,
      letters:
        Array.isArray(parsed.letters) && parsed.letters.length === size
          ? (parsed.letters as string[])
          : new Array(size).fill(""),
      revealed: new Set(Array.isArray(parsed.revealed) ? (parsed.revealed as number[]) : []),
    };
  } catch {
    // Navegación privada o almacenamiento bloqueado: se juega sin guardar.
    return emptyProgress(id, size);
  }
}

export function DameroBoard({ damero }: { damero: Damero }) {
  const { grid, entries } = damero;

  // Las letras y las casillas reveladas van juntas porque se cargan y se
  // guardan a la vez: así restaurar una partida es un único cambio de estado.
  const [progress, setProgress] = useState<Progress>(() =>
    emptyProgress(null, grid.blocks.length),
  );
  const { letters, revealed } = progress;

  const setLetters = useCallback((update: (previous: string[]) => string[]) => {
    setProgress((previous) => ({ ...previous, letters: update(previous.letters) }));
  }, []);

  const setRevealed = useCallback((update: (previous: Set<number>) => Set<number>) => {
    setProgress((previous) => ({ ...previous, revealed: update(previous.revealed) }));
  }, []);

  const [selected, setSelected] = useState<Selection | null>(null);
  const [checking, setChecking] = useState(false);

  const captureRef = useRef<HTMLInputElement>(null);

  /** Casilla -> la clave a la que pertenece y en qué posición. */
  const owner = useMemo(() => {
    const map = new Map<number, Selection>();
    entries.forEach((entry, index) => {
      entry.cells.forEach((cell, position) => map.set(cell, { entry: index, position }));
    });
    return map;
  }, [entries]);

  // --- Progreso guardado ---------------------------------------------------

  useEffect(() => {
    // El servidor no tiene `localStorage`, así que la partida guardada solo
    // puede leerse ya montados: hacerlo en el inicializador de `useState`
    // rompería la hidratación. Es una carga única por damero, no un ciclo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(readProgress(damero.id, grid.blocks.length));
  }, [damero.id, grid.blocks.length]);

  useEffect(() => {
    // Hasta que no se ha cargado lo guardado, escribir sobrescribiría la
    // partida con el tablero vacío del primer render.
    if (progress.id !== damero.id) return;
    try {
      localStorage.setItem(
        storageKey(damero.id),
        JSON.stringify({ letters: progress.letters, revealed: [...progress.revealed] }),
      );
    } catch {
      // Sin espacio: seguimos jugando, simplemente no se guarda.
    }
  }, [progress, damero.id]);

  // --- Selección -----------------------------------------------------------

  const select = useCallback((next: Selection | null) => {
    setSelected(next);
    if (next) captureRef.current?.focus({ preventScroll: true });
  }, []);

  const selectCell = useCallback(
    (cell: number) => {
      const target = owner.get(cell);
      if (target) select(target);
    },
    [owner, select],
  );

  const currentCell =
    selected === null ? null : (entries[selected.entry]?.cells[selected.position] ?? null);

  // --- Escritura -----------------------------------------------------------

  const write = useCallback(
    (letter: string) => {
      if (!selected) return;
      const entry = entries[selected.entry];
      const cell = entry.cells[selected.position];
      setLetters((previous) => {
        const next = previous.slice();
        next[cell] = letter;
        return next;
      });
      setChecking(false);
      // Autoavance dentro de la propia respuesta; al final se queda quieto.
      if (selected.position < entry.answer.length - 1) {
        select({ entry: selected.entry, position: selected.position + 1 });
      }
    },
    [entries, select, selected, setLetters],
  );

  const erase = useCallback(() => {
    if (!selected) return;
    const entry = entries[selected.entry];
    const cell = entry.cells[selected.position];
    setChecking(false);

    // Si la casilla ya está vacía, el borrado se lleva la anterior: es lo que
    // espera quien pulsa retroceso varias veces seguidas.
    if (!letters[cell] && selected.position > 0) {
      const previousPosition = selected.position - 1;
      const previousCell = entry.cells[previousPosition];
      setLetters((previous) => {
        const next = previous.slice();
        next[previousCell] = "";
        return next;
      });
      select({ entry: selected.entry, position: previousPosition });
      return;
    }

    setLetters((previous) => {
      const next = previous.slice();
      next[cell] = "";
      return next;
    });
  }, [entries, letters, select, selected, setLetters]);

  const move = useCallback(
    (delta: number) => {
      if (!selected) return;
      const entry = entries[selected.entry];
      const position = selected.position + delta;
      if (position >= 0 && position < entry.answer.length) {
        select({ entry: selected.entry, position });
        return;
      }
      // Fuera de la respuesta se salta a la clave contigua.
      const index = selected.entry + (delta > 0 ? 1 : -1);
      if (index < 0 || index >= entries.length) return;
      select({
        entry: index,
        position: delta > 0 ? 0 : entries[index].answer.length - 1,
      });
    },
    [entries, select, selected],
  );

  // El teclado se escucha en la ventana, no en la caja oculta. Depender del
  // foco era frágil: un clic real en una casilla lo deja en el botón o en el
  // propio documento, y entonces no se podía escribir con el teclado físico.
  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // Si algún día hay un campo de texto de verdad, que se escriba en él.
      if (target?.isContentEditable) return;
      if (target instanceof HTMLInputElement && !target.classList.contains("capture-input")) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        erase();
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Tab") {
        // El tabulador salta de clave en clave, no de casilla en casilla.
        event.preventDefault();
        const index = selected!.entry + (event.shiftKey ? -1 : 1);
        if (index >= 0 && index < entries.length) select({ entry: index, position: 0 });
      } else if (event.key.length === 1) {
        const letter = normalizeKey(event.key);
        if (letter) {
          event.preventDefault();
          write(letter);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entries.length, erase, move, select, selected, write]);

  /** El móvil no siempre emite keydown: lo que llega es un cambio de valor. */
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      event.target.value = "";
      const letter = normalizeKey(value.slice(-1));
      if (letter) write(letter);
    },
    [write],
  );

  // --- Ayudas --------------------------------------------------------------

  const revealCells = useCallback(
    (cells: number[]) => {
      setLetters((previous) => {
        const next = previous.slice();
        for (const cell of cells) next[cell] = grid.solution[cell];
        return next;
      });
      setRevealed((previous) => {
        const next = new Set(previous);
        for (const cell of cells) next.add(cell);
        return next;
      });
      setChecking(false);
    },
    [grid.solution, setLetters, setRevealed],
  );

  const revealLetter = useCallback(() => {
    if (currentCell !== null) revealCells([currentCell]);
  }, [currentCell, revealCells]);

  const revealWord = useCallback(() => {
    if (selected) revealCells(entries[selected.entry].cells);
  }, [entries, revealCells, selected]);

  const revealAll = useCallback(() => {
    if (!confirm("¿Seguro que quieres ver la solución entera?")) return;
    revealCells(grid.whiteCells);
  }, [grid.whiteCells, revealCells]);

  const clear = useCallback(() => {
    if (!confirm("¿Borrar todo lo escrito?")) return;
    setProgress((previous) => emptyProgress(previous.id, grid.blocks.length));
    setChecking(false);
  }, [grid.blocks.length]);

  // --- Estado de la partida ------------------------------------------------

  const filled = grid.whiteCells.filter((cell) => letters[cell]).length;
  const solved =
    filled === grid.whiteCells.length &&
    grid.whiteCells.every((cell) => letters[cell] === grid.solution[cell]);

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={captureRef}
        className="capture-input"
        // Sin autocorrección ni sugerencias: aquí solo entran letras sueltas.
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        aria-hidden
        tabIndex={-1}
        onChange={handleChange}
      />

      <DameroGrid
        grid={grid}
        entries={entries}
        letters={letters}
        owner={owner}
        selected={selected}
        currentCell={currentCell}
        checking={checking}
        revealed={revealed}
        onSelectCell={selectCell}
      />

      <Toolbar
        solved={solved}
        filled={filled}
        total={grid.whiteCells.length}
        hasSelection={selected !== null}
        checking={checking}
        onCheck={() => setChecking((value) => !value)}
        onRevealLetter={revealLetter}
        onRevealWord={revealWord}
        onRevealAll={revealAll}
        onClear={clear}
      />

      {solved && (
        <section className="rounded-lg border border-rule bg-card p-5 text-center">
          <p className="text-sm font-semibold tracking-wide text-ok uppercase">Resuelto</p>
          <blockquote className="mt-3 text-lg leading-relaxed text-balance italic">
            «{damero.quote.text}»
          </blockquote>
          <p className="mt-3 text-sm text-ink-soft">
            {damero.quote.author}, <cite>{damero.quote.work}</cite>
          </p>
        </section>
      )}

      <ClueList
        entries={entries}
        letters={letters}
        selected={selected}
        checking={checking}
        revealed={revealed}
        solution={grid.solution}
        onSelect={select}
      />
    </div>
  );
}
