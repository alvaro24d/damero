/**
 * Preparación de la frase: normalización, acróstico y maquetación en la
 * cuadrícula.
 *
 * La frase se escribe en la retícula en orden de lectura, una letra por
 * casilla blanca, con una casilla negra entre palabras. Las palabras pueden
 * partirse al final de una fila y continuar en la siguiente, igual que en los
 * dameros de prensa: lo que marca los cortes son las negras, no los bordes.
 */

import type { Grid, PreparedQuote, Quote } from "./types.ts";

/** Acentos y diéresis -> letra base. La Ñ se conserva. */
const DEACCENT: Record<string, string> = {
  Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U",
  À: "A", È: "E", Ì: "I", Ò: "O", Ù: "U", Â: "A", Ê: "E", Ô: "O",
};

const LETTER = /[A-ZÑ]/;

/**
 * "¿Qué es la vida?" -> "QUEESLAVIDA".
 * Descarta todo lo que no sea letra: espacios, puntuación y dígitos.
 */
export function normalizeLetters(text: string): string {
  let out = "";
  for (const raw of text.toUpperCase()) {
    const ch = DEACCENT[raw] ?? raw;
    if (LETTER.test(ch)) out += ch;
  }
  return out;
}

/**
 * "¿Qué es la vida?" -> ["QUE", "ES", "LA", "VIDA"].
 * Cada elemento acabará separado del siguiente por una casilla negra.
 */
export function splitWords(text: string): string[] {
  const words: string[] = [];
  let current = "";
  for (const raw of text.toUpperCase()) {
    const ch = DEACCENT[raw] ?? raw;
    if (LETTER.test(ch)) {
      current += ch;
    } else if (current) {
      words.push(current);
      current = "";
    }
  }
  if (current) words.push(current);
  return words;
}

/** Añade a la frase lo que se deriva de ella: sus letras y su acróstico. */
export function prepareQuote(quote: Quote): PreparedQuote {
  return {
    ...quote,
    letters: normalizeLetters(quote.text),
    acrostic: normalizeLetters(`${quote.author}${quote.work}`),
  };
}

// --- Maquetación ----------------------------------------------------------

/** Anchos admitidos para la retícula, como en los dameros de periódico. */
export const MIN_WIDTH = 15;
export const MAX_WIDTH = 21;

/**
 * Elige el ancho que deja menos casillas negras sobrantes en la última fila.
 * A igualdad de desperdicio prefiere la retícula más ancha, que queda más
 * parecida a la de prensa. Es determinista: no depende de la semilla.
 */
export function chooseWidth(cellCount: number): number {
  let best = MAX_WIDTH;
  let bestWaste = Number.POSITIVE_INFINITY;
  for (let width = MIN_WIDTH; width <= MAX_WIDTH; width++) {
    const waste = (width - (cellCount % width)) % width;
    if (waste < bestWaste || (waste === bestWaste && width > best)) {
      best = width;
      bestWaste = waste;
    }
  }
  return best;
}

/**
 * Coloca las palabras de la frase en una retícula de `width` columnas.
 * Devuelve la geometría y la solución; el reparto entre definiciones se hace
 * después, en el rellenador.
 */
export function buildGrid(words: string[], width: number): Grid {
  // Secuencia de casillas: letras de cada palabra, negra entre palabra y palabra.
  const sequence: (string | null)[] = [];
  words.forEach((word, i) => {
    for (const letter of word) sequence.push(letter);
    if (i < words.length - 1) sequence.push(null);
  });

  const height = Math.ceil(sequence.length / width);
  const size = width * height;

  const blocks: boolean[] = new Array(size).fill(true);
  const solution: string[] = new Array(size).fill("");
  const whiteCells: number[] = [];

  for (let i = 0; i < sequence.length; i++) {
    const letter = sequence[i];
    if (letter === null) continue; // separador: se queda negra
    blocks[i] = false;
    solution[i] = letter;
    whiteCells.push(i);
  }

  return { width, height, blocks, solution, whiteCells };
}

/** Atajo: de la frase en bruto a la retícula. */
export function gridFromQuote(quote: Quote): Grid {
  const words = splitWords(quote.text);
  const cellCount = words.reduce((n, w) => n + w.length, 0) + words.length - 1;
  return buildGrid(words, chooseWidth(cellCount));
}

// --- Validación del repertorio -------------------------------------------

/** Iniciales sin candidatos suficientes en el diccionario español. */
export const SCARCE_INITIALS = new Set(["Ñ", "X", "W", "K"]);

/** Recuento de cada letra de una cadena ya normalizada. */
export function letterCounts(letters: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of letters) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

export interface QuoteCheck {
  id: string;
  /** Letras de la frase = casillas blancas = letras a repartir. */
  letterCount: number;
  /** Letras del acróstico = número de definiciones. */
  entryCount: number;
  /** Longitud media que tendrá cada respuesta. */
  averageAnswer: number;
  problems: string[];
}

/**
 * Comprueba que una frase se pueda convertir en damero.
 *
 * El acróstico fija cuántas definiciones hay y la frase cuántas letras hay
 * que repartir entre ellas, así que la proporción entre ambos decide si el
 * reparto es siquiera posible: con menos de 3 letras por respuesta no hay
 * palabras, y con más de 9 el diccionario se queda corto.
 */
export function checkQuote(
  quote: Quote,
  { minAnswer = 3, maxAnswer = 9 } = {},
): QuoteCheck {
  const prepared = prepareQuote(quote);
  const letterCount = prepared.letters.length;
  const entryCount = prepared.acrostic.length;
  const average = letterCount / entryCount;
  const problems: string[] = [];

  if (average < minAnswer + 0.6) {
    problems.push(
      `media ${average.toFixed(1)}: el acróstico es largo para la frase (alarga la cita o acorta el título)`,
    );
  }
  if (average > maxAnswer - 1.5) {
    problems.push(
      `media ${average.toFixed(1)}: la frase es larga para el acróstico (acorta la cita)`,
    );
  }

  // Condición necesaria y fácil de pasar por alto: cada letra del acróstico
  // es la INICIAL de una respuesta, y esa inicial acaba en la cuadrícula. Si
  // el acróstico pide más jotas de las que tiene la frase, no hay reparto
  // posible por mucho que se busque. Es la causa de casi todos los dameros
  // irresolubles: "Don Quijote" exige una J que la cita no contiene.
  const inQuote = letterCounts(prepared.letters);
  const inAcrostic = letterCounts(prepared.acrostic);
  for (const [letter, needed] of inAcrostic) {
    const available = inQuote.get(letter) ?? 0;
    if (available < needed) {
      problems.push(
        `el acróstico necesita ${needed} ${letter} y la frase solo tiene ${available}` +
          ` (alarga la cita con alguna palabra que lleve ${letter})`,
      );
    }
  }

  const scarce = [...prepared.acrostic].filter((ch) => SCARCE_INITIALS.has(ch));
  const counts = new Map<string, number>();
  for (const ch of scarce) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const [letter, n] of counts) {
    if (n > 1) {
      problems.push(`${n} definiciones tendrían que empezar por ${letter}, y apenas hay palabras`);
    }
  }

  return {
    id: quote.id,
    letterCount,
    entryCount,
    averageAnswer: average,
    problems,
  };
}
