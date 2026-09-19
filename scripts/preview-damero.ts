/**
 * Genera un damero por consola, sin definiciones, para ver cómo queda.
 *
 * Uso:
 *   node scripts/preview-damero.ts                  damero de hoy
 *   node scripts/preview-damero.ts --seed 12345     semilla concreta
 *   node scripts/preview-damero.ts --date 20261225  otro día
 *   node scripts/preview-damero.ts --all            prueba todo el repertorio
 */

import { buildDamero } from "../lib/damero.ts";
import { prepareQuote } from "../lib/quote.ts";
import { dailyKey, seedFromKey } from "../lib/seed.ts";
import { loadQuotes, loadWordIndex } from "../lib/wordlist.ts";
import { rowLabel } from "../lib/types.ts";
import type { Damero } from "../lib/types.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const quotes = loadQuotes();
console.log("Construyendo el índice del diccionario...");
const started = Date.now();
const index = loadWordIndex();
console.log(`Índice listo en ${Date.now() - started} ms.\n`);

if (process.argv.includes("--all")) {
  runAll();
} else {
  const key = arg("date") ?? dailyKey();
  const seed = arg("seed") ? Number(arg("seed")) : seedFromKey(key);
  const t0 = Date.now();
  const damero = buildDamero(quotes, index, seed, key, true);
  if (!damero) {
    console.error("No se ha podido construir el damero con esta semilla.");
    process.exit(1);
  }
  console.log(`Generado en ${Date.now() - t0} ms (semilla ${seed}).\n`);
  print(damero);
}

// --- Salida ---------------------------------------------------------------

function print(damero: Damero): void {
  const { grid, entries, quote } = damero;

  const tens = Array.from({ length: grid.width }, (_, c) =>
    c + 1 >= 10 ? String(Math.floor((c + 1) / 10)) : " ",
  );
  const units = Array.from({ length: grid.width }, (_, c) => String((c + 1) % 10));
  console.log(`     ${tens.join(" ")}`);
  console.log(`     ${units.join(" ")}`);
  for (let row = 0; row < grid.height; row++) {
    const cells = Array.from({ length: grid.width }, (_, col) => {
      const i = row * grid.width + col;
      return grid.blocks[i] ? "█" : grid.solution[i];
    });
    console.log(` ${rowLabel(row).padStart(2)}  ${cells.join(" ")}`);
  }

  console.log("");
  console.log("CLAVES");
  for (const entry of entries) {
    const coords = entry.coords.join(" ");
    console.log(`  ${entry.label.padStart(2)}  ${entry.answer.padEnd(11)} ${coords}`);
  }

  console.log("");
  console.log(`Acróstico: ${entries.map((e) => e.answer[0]).join("")}`);
  console.log(`Esperado:  ${prepareQuote(quote).acrostic}`);
  console.log("");
  console.log(`Frase: "${quote.text}"`);
  console.log(`       — ${quote.author}, ${quote.work}`);

  const lengths = entries.map((e) => e.answer.length);
  const histogram = new Map<number, number>();
  for (const n of lengths) histogram.set(n, (histogram.get(n) ?? 0) + 1);
  console.log("");
  console.log(
    `${entries.length} definiciones · longitudes ` +
      [...histogram.keys()]
        .sort((a, b) => a - b)
        .map((n) => `${n}:${histogram.get(n)}`)
        .join(" "),
  );
}

// --- Prueba de todo el repertorio ----------------------------------------

function runAll(): void {
  let ok = 0;
  for (const quote of quotes) {
    const seed = seedFromKey(quote.id);
    const t0 = Date.now();
    // Sin reintentos de frase: queremos saber si ESTA frase se resuelve.
    const damero = buildDamero([quote], index, seed, quote.id, false, { quoteAttempts: 1 });
    const ms = Date.now() - t0;
    if (damero) {
      ok++;
      const lengths = damero.entries.map((e) => e.answer.length);
      console.log(
        `OK    ${quote.id.padEnd(26)} ${String(ms).padStart(6)} ms  ` +
          `${damero.entries.length} defs  ${Math.min(...lengths)}-${Math.max(...lengths)} letras`,
      );
    } else {
      console.log(`FALLA ${quote.id.padEnd(26)} ${String(ms).padStart(6)} ms`);
    }
  }
  console.log(`\n${ok} de ${quotes.length} frases resueltas.`);
}
