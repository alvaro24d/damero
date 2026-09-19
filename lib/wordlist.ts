/**
 * Carga de los datos generados (diccionario y repertorio de frases).
 *
 * Solo para el servidor: lee de `data/` con `fs` en lugar de importar los
 * JSON, para que el megabyte del diccionario no acabe en el bundle del
 * cliente. El índice es caro de construir, así que se memoriza por proceso.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildWordIndex, type WordIndex } from "./acrostic-filler.ts";
import type { Quote } from "./types.ts";

const DATA_DIR = join(process.cwd(), "data");

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, name), "utf8")) as T;
}

let index: WordIndex | null = null;

export function loadWordIndex(): WordIndex {
  if (!index) {
    index = buildWordIndex(
      readJson<Record<string, string[]>>("wordlist.json"),
      readJson<Record<string, string>>("word-forms.json"),
    );
  }
  return index;
}

let quotes: Quote[] | null = null;

export function loadQuotes(): Quote[] {
  if (!quotes) quotes = readJson<Quote[]>("quotes.json");
  return quotes;
}
