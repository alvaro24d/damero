"use client";

/** Progreso y ayudas. Las que revelan solución piden confirmación arriba. */

import Link from "next/link";

interface Props {
  solved: boolean;
  filled: number;
  total: number;
  hasSelection: boolean;
  checking: boolean;
  onCheck: () => void;
  onRevealLetter: () => void;
  onRevealWord: () => void;
  onRevealAll: () => void;
  onClear: () => void;
}

const BUTTON =
  "rounded-md border border-rule bg-card px-3 py-1.5 text-sm transition-colors " +
  "hover:bg-active-soft disabled:cursor-not-allowed disabled:opacity-40 " +
  "outline-none focus-visible:ring-2 focus-visible:ring-ink";

export function Toolbar({
  solved,
  filled,
  total,
  hasSelection,
  checking,
  onCheck,
  onRevealLetter,
  onRevealWord,
  onRevealAll,
  onClear,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto font-mono text-xs text-ink-soft" aria-live="polite">
        {solved ? "completo" : `${filled} / ${total} casillas`}
      </span>

      <button type="button" className={BUTTON} onClick={onCheck} aria-pressed={checking}>
        {checking ? "Ocultar fallos" : "Comprobar"}
      </button>
      <button type="button" className={BUTTON} onClick={onRevealLetter} disabled={!hasSelection}>
        Revelar letra
      </button>
      <button type="button" className={BUTTON} onClick={onRevealWord} disabled={!hasSelection}>
        Revelar palabra
      </button>
      <button type="button" className={BUTTON} onClick={onRevealAll}>
        Revelar todo
      </button>
      <button type="button" className={BUTTON} onClick={onClear}>
        Borrar
      </button>
      <Link href="/practica" prefetch={false} className={BUTTON}>
        Nuevo damero aleatorio
      </Link>
    </div>
  );
}
