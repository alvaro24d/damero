/**
 * Reparto de las letras de la frase entre las definiciones del damero.
 *
 * EL PROBLEMA. La frase aporta un multiconjunto exacto de letras. El acróstico
 * (autor + obra) dice cuántas respuestas hay y por qué letra empieza cada una.
 * Hay que partir ese multiconjunto en palabras reales sin que sobre ni falte
 * una sola letra.
 *
 * POR QUÉ NO SE HACE CON BACKTRACKING. La primera versión iba colocando
 * palabras una a una y retrocediendo. Funcionaba a ratos y se atascaba el
 * resto: el reparto puede ir bien durante treinta palabras y ser imposible por
 * la última letra, y descubrirlo al final obliga a deshacerlo casi todo. La
 * dificultad no está en encontrar palabras, está en cuadrar el recuento.
 *
 * LO QUE SE HACE. Búsqueda local por mínimos conflictos. Se parte de un
 * reparto completo con las iniciales correctas y la suma de longitudes
 * correcta —aunque las letras no cuadren— y se cambia una palabra cada vez por
 * otra que acerque el recuento al de la frase. El coste es la distancia entre
 * ambos recuentos; cuando llega a cero, el damero está hecho. Resuelve en
 * milisegundos lo que al backtracking le costaba medio minuto para rendirse.
 *
 * Dos detalles sin los cuales no converge:
 * - Se aceptan los cambios que EMPATAN, no solo los que mejoran: los empates
 *   son los que permiten recorrer una meseta y salir por otro lado.
 * - Cada tanto se mueve una unidad de longitud de un hueco a otro. El reparto
 *   de longitudes del arranque es, si no, una jaula: con letras de más en los
 *   huecos equivocados no hay sustitución que salve el reparto.
 *
 * Que una frase admita reparto no es casualidad: hay que comprobarlo antes
 * (`checkQuote` en `lib/quote.ts`). Cada letra del acróstico es la inicial de
 * una respuesta y acaba en la cuadrícula, así que si el acróstico pide más
 * jotas de las que tiene la frase, no hay reparto posible.
 */

import { mulberry32, type Rng } from "./seed.ts";
import type { PreparedQuote } from "./types.ts";

/** Longitud admitida para una respuesta. */
export const MIN_ANSWER = 3;
export const MAX_ANSWER = 10;

/** El alfabeto del damero: A-Z más la Ñ. */
const ALPHABET_SIZE = 27;
const ENYE = 26;

export function letterIndex(letter: string): number {
  return letter === "Ñ" ? ENYE : letter.charCodeAt(0) - 65;
}

export function indexLetter(index: number): string {
  return index === ENYE ? "Ñ" : String.fromCharCode(65 + index);
}

interface IndexedWord {
  word: string;
  length: number;
  /** Pares [letra, repeticiones]: el recuento de la palabra, compacto. */
  counts: [number, number][];
}

export interface WordIndex {
  /** `pools[inicial][longitud]`, de palabra común a palabra rara. */
  pools: IndexedWord[][][];
  /** Forma con tildes de cada palabra, si difiere de la normalizada. */
  display: Record<string, string>;
}

/**
 * Prepara las estructuras que consulta el rellenador. Es caro, así que se
 * construye una vez y se reutiliza (ver `lib/wordlist.ts`).
 */
export function buildWordIndex(
  byLength: Record<string, string[]>,
  display: Record<string, string>,
): WordIndex {
  const pools: IndexedWord[][][] = Array.from({ length: ALPHABET_SIZE }, () =>
    Array.from({ length: MAX_ANSWER + 1 }, () => [] as IndexedWord[]),
  );

  for (const [rawLength, words] of Object.entries(byLength)) {
    const length = Number(rawLength);
    if (length < MIN_ANSWER || length > MAX_ANSWER) continue;

    // Cada lista viene ordenada por frecuencia de uso y así se conserva.
    for (const word of words) {
      const vector = new Int8Array(ALPHABET_SIZE);
      for (const ch of word) vector[letterIndex(ch)]++;
      const counts: [number, number][] = [];
      for (let i = 0; i < ALPHABET_SIZE; i++) {
        if (vector[i]) counts.push([i, vector[i]]);
      }
      pools[letterIndex(word[0])][length].push({ word, length, counts });
    }
  }

  return { pools, display };
}

export interface FillOptions {
  /** Repartos de longitudes distintos que se prueban. */
  restarts?: number;
  /** Cambios de palabra por reparto antes de reiniciar. */
  sweeps?: number;
  /** Candidatas que se sortean en cada cambio. */
  sample?: number;
}

/**
 * Devuelve una palabra por cada letra del acróstico, o `null` si no encuentra
 * reparto. El resultado es determinista para la misma semilla.
 */
export function fillAcrostic(
  quote: PreparedQuote,
  index: WordIndex,
  seed: number,
  { restarts = 60, sweeps = 12_000, sample: sampleSize = 300 }: FillOptions = {},
): string[] | null {
  const { pools } = index;
  const rng = mulberry32(seed >>> 0);

  const target = new Int32Array(ALPHABET_SIZE);
  for (const ch of quote.letters) target[letterIndex(ch)]++;
  const total = quote.letters.length;
  const initials = [...quote.acrostic].map(letterIndex);
  const slotCount = initials.length;

  if (total < MIN_ANSWER * slotCount || total > MAX_ANSWER * slotCount) return null;

  for (let restart = 0; restart < restarts; restart++) {
    const lengths = sampleLengths(rng, initials, total, pools);
    if (!lengths) continue;

    const current = initialWords(rng, initials, lengths, pools);
    if (!current) continue;

    const taken = new Set(current.map((w) => w.word));

    // diff = lo que tenemos menos lo que hace falta. El objetivo es dejarlo a cero.
    const diff = new Int32Array(ALPHABET_SIZE);
    for (let i = 0; i < ALPHABET_SIZE; i++) diff[i] = -target[i];
    for (const word of current) {
      for (const [letter, n] of word.counts) diff[letter] += n;
    }
    let cost = absSum(diff);

    for (let sweep = 0; sweep < sweeps && cost > 0; sweep++) {
      cost =
        rng() < 0.12
          ? moveLength(rng, initials, lengths, current, taken, diff, pools, cost)
          : swapWord(rng, initials, lengths, current, taken, diff, pools, cost, sampleSize);
    }

    if (cost === 0) return current.map((w) => w.word);
  }

  return null;
}

// --- Piezas de la búsqueda ------------------------------------------------

function absSum(values: Int32Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += Math.abs(values[i]);
  return sum;
}

/**
 * Longitudes que suman exactamente las letras de la frase y para las que hay
 * palabras con la inicial que toca. Se parte de la media y se ajusta al azar.
 */
function sampleLengths(
  rng: Rng,
  initials: number[],
  total: number,
  pools: IndexedWord[][][],
): number[] | null {
  const slotCount = initials.length;
  const average = total / slotCount;
  const lengths = new Array<number>(slotCount);

  for (let i = 0; i < slotCount; i++) {
    const jitter = Math.round((rng() - 0.5) * 4);
    lengths[i] = Math.max(MIN_ANSWER, Math.min(MAX_ANSWER, Math.round(average) + jitter));
  }

  for (let guard = 0; guard < 20_000; guard++) {
    let sum = 0;
    for (const length of lengths) sum += length;
    if (sum === total) break;

    const i = Math.floor(rng() * slotCount);
    const next = lengths[i] + (sum > total ? -1 : 1);
    if (next < MIN_ANSWER || next > MAX_ANSWER) continue;
    if (pools[initials[i]][next].length === 0) continue;
    lengths[i] = next;
  }

  let sum = 0;
  for (const length of lengths) sum += length;
  if (sum !== total) return null;
  for (let i = 0; i < slotCount; i++) {
    if (pools[initials[i]][lengths[i]].length === 0) return null;
  }
  return lengths;
}

/**
 * Saca una palabra de la lista con sesgo hacia la cabecera.
 *
 * Las listas van de palabra común a palabra rara. Sortear uniformemente da
 * dameros llenos de URCA y de ÑAQUE: con el cuadrado del azar, las tres
 * cuartas partes de las extracciones caen en la mitad más conocida, y aun así
 * la cola sigue disponible cuando el reparto la necesita.
 */
function sample(rng: Rng, pool: IndexedWord[]): IndexedWord {
  const r = rng();
  return pool[Math.floor(pool.length * r * r)];
}

/** Una palabra al azar por hueco, sin repetir ninguna. */
function initialWords(
  rng: Rng,
  initials: number[],
  lengths: number[],
  pools: IndexedWord[][][],
): IndexedWord[] | null {
  const chosen: IndexedWord[] = [];
  const taken = new Set<string>();

  for (let i = 0; i < initials.length; i++) {
    const pool = pools[initials[i]][lengths[i]];
    let pick: IndexedWord | null = null;
    for (let attempt = 0; attempt < 30 && !pick; attempt++) {
      const candidate = sample(rng, pool);
      if (!taken.has(candidate.word)) pick = candidate;
    }
    if (!pick) return null;
    chosen.push(pick);
    taken.add(pick.word);
  }
  return chosen;
}

/**
 * Cambia la palabra de un hueco por otra de la misma inicial y longitud.
 * Elige el hueco que más letras sobrantes aporta y la sustituta que más baja
 * el coste. Devuelve el coste resultante.
 */
function swapWord(
  rng: Rng,
  initials: number[],
  lengths: number[],
  current: IndexedWord[],
  taken: Set<string>,
  diff: Int32Array,
  pools: IndexedWord[][][],
  cost: number,
  sampleSize: number,
): number {
  // El hueco más "culpable": el que más aporta de lo que sobra. El ruido
  // evita que la búsqueda se quede dando vueltas sobre el mismo.
  let slot = 0;
  let worst = -1;
  for (let i = 0; i < current.length; i++) {
    let excess = 0;
    for (const [letter, n] of current[i].counts) {
      if (diff[letter] > 0) excess += Math.min(n, diff[letter]);
    }
    const score = excess + rng() * 1.5;
    if (score > worst) {
      worst = score;
      slot = i;
    }
  }

  const previous = current[slot];
  for (const [letter, n] of previous.counts) diff[letter] -= n;
  const base = absSum(diff);

  const pool = pools[initials[slot]][lengths[slot]];
  let best: IndexedWord | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  const tries = Math.min(sampleSize, pool.length);
  for (let t = 0; t < tries; t++) {
    const candidate = sample(rng, pool);
    if (candidate === previous || taken.has(candidate.word)) continue;

    let candidateCost = base;
    for (const [letter, n] of candidate.counts) {
      candidateCost += Math.abs(diff[letter] + n) - Math.abs(diff[letter]);
    }
    if (candidateCost < bestCost) {
      bestCost = candidateCost;
      best = candidate;
    }
  }

  // Los empates también se aceptan: son los que dejan recorrer la meseta.
  if (best && bestCost <= cost) {
    taken.delete(previous.word);
    taken.add(best.word);
    current[slot] = best;
    for (const [letter, n] of best.counts) diff[letter] += n;
    return bestCost;
  }

  for (const [letter, n] of previous.counts) diff[letter] += n;
  return cost;
}

/**
 * Pasa una unidad de longitud de un hueco a otro manteniendo la suma total.
 * Sin esto la búsqueda queda encerrada en el reparto de longitudes inicial.
 */
function moveLength(
  rng: Rng,
  initials: number[],
  lengths: number[],
  current: IndexedWord[],
  taken: Set<string>,
  diff: Int32Array,
  pools: IndexedWord[][][],
  cost: number,
): number {
  const slotCount = current.length;
  const from = Math.floor(rng() * slotCount);
  const to = Math.floor(rng() * slotCount);
  if (from === to) return cost;

  const shorter = lengths[from] - 1;
  const longer = lengths[to] + 1;
  if (shorter < MIN_ANSWER || longer > MAX_ANSWER) return cost;

  const poolFrom = pools[initials[from]][shorter];
  const poolTo = pools[initials[to]][longer];
  if (poolFrom.length === 0 || poolTo.length === 0) return cost;

  const oldFrom = current[from];
  const oldTo = current[to];
  for (const [letter, n] of oldFrom.counts) diff[letter] -= n;
  for (const [letter, n] of oldTo.counts) diff[letter] -= n;
  const base = absSum(diff);

  let bestFrom: IndexedWord | null = null;
  let bestTo: IndexedWord | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let t = 0; t < 60; t++) {
    const a = sample(rng, poolFrom);
    const b = sample(rng, poolTo);
    if (a.word === b.word) continue;
    if (taken.has(a.word) && a.word !== oldFrom.word && a.word !== oldTo.word) continue;
    if (taken.has(b.word) && b.word !== oldFrom.word && b.word !== oldTo.word) continue;

    let candidateCost = base;
    for (const [letter, n] of a.counts) {
      candidateCost += Math.abs(diff[letter] + n) - Math.abs(diff[letter]);
    }
    // El aporte de la segunda palabra se mide sobre el recuento que deja la primera.
    for (const [letter, n] of b.counts) {
      const withA = diff[letter] + countOf(a, letter);
      candidateCost += Math.abs(withA + n) - Math.abs(withA);
    }
    if (candidateCost < bestCost) {
      bestCost = candidateCost;
      bestFrom = a;
      bestTo = b;
    }
  }

  if (bestFrom && bestTo && bestCost <= cost) {
    taken.delete(oldFrom.word);
    taken.delete(oldTo.word);
    taken.add(bestFrom.word);
    taken.add(bestTo.word);
    current[from] = bestFrom;
    current[to] = bestTo;
    lengths[from] = shorter;
    lengths[to] = longer;
    for (const [letter, n] of bestFrom.counts) diff[letter] += n;
    for (const [letter, n] of bestTo.counts) diff[letter] += n;
    return bestCost;
  }

  for (const [letter, n] of oldFrom.counts) diff[letter] += n;
  for (const [letter, n] of oldTo.counts) diff[letter] += n;
  return cost;
}

function countOf(word: IndexedWord, letter: number): number {
  for (const [candidate, n] of word.counts) {
    if (candidate === letter) return n;
  }
  return 0;
}
