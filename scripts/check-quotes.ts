/**
 * Revisa el repertorio de frases y dibuja la retícula de una de ellas.
 *
 * Uso:
 *   node scripts/check-quotes.ts             informe de todas las frases
 *   node scripts/check-quotes.ts <id>        dibuja la retícula de esa frase
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { checkQuote, gridFromQuote, prepareQuote, splitWords } from "../lib/quote.ts";
import { rowLabel } from "../lib/types.ts";
import type { Quote } from "../lib/types.ts";

const quotes: Quote[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/quotes.json"), "utf8"),
);

const wordlist: Record<string, string[]> = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/wordlist.json"), "utf8"),
);
const byInitial = new Map<string, number>();
for (const word of Object.values(wordlist).flat()) {
  byInitial.set(word[0], (byInitial.get(word[0]) ?? 0) + 1);
}

const target = process.argv[2];

if (target) {
  const quote = quotes.find((q) => q.id === target);
  if (!quote) {
    console.error(`No existe la frase "${target}".`);
    process.exit(1);
  }
  drawGrid(quote);
} else {
  report();
}

// --- Informe --------------------------------------------------------------

function report(): void {
  console.log("id                          letras  defs  media  acróstico");
  console.log("-".repeat(78));

  let usable = 0;
  const issues: string[] = [];

  for (const quote of quotes) {
    const check = checkQuote(quote);
    const prepared = prepareQuote(quote);
    const flag = check.problems.length === 0 ? " " : "!";
    if (check.problems.length === 0) usable++;

    console.log(
      `${flag} ${quote.id.padEnd(26)} ${String(check.letterCount).padStart(5)} ` +
        `${String(check.entryCount).padStart(5)} ${check.averageAnswer.toFixed(1).padStart(6)}  ` +
        `${prepared.acrostic.slice(0, 30)}${prepared.acrostic.length > 30 ? "..." : ""}`,
    );
    for (const problem of check.problems) issues.push(`  ${quote.id}: ${problem}`);
  }

  console.log("-".repeat(78));
  console.log(`${usable} de ${quotes.length} frases utilizables.`);
  if (issues.length) {
    console.log("\nAvisos:");
    for (const issue of issues) console.log(issue);
  }

  // Iniciales que el repertorio exige y que el diccionario apenas cubre.
  const demanded = new Map<string, number>();
  for (const quote of quotes) {
    for (const ch of prepareQuote(quote).acrostic) {
      demanded.set(ch, (demanded.get(ch) ?? 0) + 1);
    }
  }
  const tight = [...demanded.keys()]
    .filter((ch) => (byInitial.get(ch) ?? 0) < 60)
    .sort();
  if (tight.length) {
    console.log("\nIniciales ajustadas (palabras disponibles en el diccionario):");
    for (const ch of tight) {
      console.log(`  ${ch}: ${byInitial.get(ch) ?? 0} palabras`);
    }
  }
}

// --- Dibujo ---------------------------------------------------------------

function drawGrid(quote: Quote): void {
  const prepared = prepareQuote(quote);
  const grid = gridFromQuote(quote);
  const check = checkQuote(quote);

  console.log(`"${quote.text}"`);
  console.log(`   — ${quote.author}, ${quote.work}`);
  console.log("");
  console.log(
    `Retícula ${grid.width}x${grid.height} · ${grid.whiteCells.length} casillas blancas · ` +
      `${splitWords(quote.text).length} palabras`,
  );
  console.log(
    `Acróstico (${prepared.acrostic.length} definiciones): ${prepared.acrostic}`,
  );
  console.log(`Longitud media de respuesta: ${check.averageAnswer.toFixed(1)} letras`);
  console.log("");

  // Cabecera de columnas, en dos filas para los números de dos cifras.
  const tens = Array.from({ length: grid.width }, (_, c) => {
    const n = c + 1;
    return n >= 10 ? String(Math.floor(n / 10)) : " ";
  });
  const units = Array.from({ length: grid.width }, (_, c) => String((c + 1) % 10));
  console.log(`    ${tens.join(" ")}`);
  console.log(`    ${units.join(" ")}`);

  for (let row = 0; row < grid.height; row++) {
    const cells: string[] = [];
    for (let col = 0; col < grid.width; col++) {
      const i = row * grid.width + col;
      cells.push(grid.blocks[i] ? "█" : grid.solution[i]);
    }
    console.log(`${rowLabel(row).padStart(2)}  ${cells.join(" ")}`);
  }
}
