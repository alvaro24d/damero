/**
 * Ensamblaje del damero: de una semilla a un pasatiempo completo.
 *
 *   semilla -> frase -> retícula -> reparto de letras -> casillas de cada clave
 *
 * Las definiciones se añaden después (`lib/clue-generator.ts`), porque son lo
 * único que necesita salir a la red.
 */

import { fillAcrostic, type WordIndex } from "./acrostic-filler.ts";
import { gridFromQuote, prepareQuote } from "./quote.ts";
import { mulberry32, shuffle, type Rng } from "./seed.ts";
import { cellCoord, entryLabel, type Damero, type Entry, type Grid, type Quote } from "./types.ts";

/**
 * Elige la frase del día. El desplazamiento por semilla reparte el repertorio
 * sin repetir hasta agotarlo: dos días seguidos nunca caen en la misma.
 */
export function pickQuote(quotes: Quote[], seed: number, offset = 0): Quote {
  return quotes[(Math.abs(seed) + offset) % quotes.length];
}

/**
 * Reparte las casillas de la retícula entre las respuestas.
 *
 * Cada letra de cada respuesta tiene que salir de una casilla distinta de la
 * frase que contenga esa misma letra. Como el reparto de letras ya cuadra
 * exactamente, basta con agrupar las casillas por letra, barajarlas y repartir:
 * el barajado es lo que dispersa las coordenadas por toda la cuadrícula, que
 * es lo que hace del damero un damero.
 */
function assignCells(grid: Grid, answers: string[], rng: Rng): number[][] {
  const pools = new Map<string, number[]>();
  for (const cell of grid.whiteCells) {
    const letter = grid.solution[cell];
    const pool = pools.get(letter);
    if (pool) pool.push(cell);
    else pools.set(letter, [cell]);
  }
  for (const [letter, cells] of pools) pools.set(letter, shuffle(rng, cells));

  return answers.map((answer) =>
    [...answer].map((letter) => {
      const cell = pools.get(letter)?.pop();
      if (cell === undefined) {
        // No debería ocurrir: el rellenador garantiza el cuadre exacto.
        throw new Error(`No quedan casillas con la letra ${letter}`);
      }
      return cell;
    }),
  );
}

export interface BuildOptions {
  /** Frases a probar antes de rendirse, por si alguna no admite reparto. */
  quoteAttempts?: number;
}

/**
 * Construye el damero de una semilla. Devuelve `null` si ninguna frase del
 * repertorio admite reparto, lo que en la práctica significa que el
 * repertorio o el diccionario necesitan revisión.
 */
export function buildDamero(
  quotes: Quote[],
  index: WordIndex,
  seed: number,
  id: string,
  daily: boolean,
  { quoteAttempts = 4 }: BuildOptions = {},
): Damero | null {
  for (let offset = 0; offset < Math.min(quoteAttempts, quotes.length); offset++) {
    const quote = pickQuote(quotes, seed, offset);
    const prepared = prepareQuote(quote);
    const answers = fillAcrostic(prepared, index, seed);
    if (!answers) continue;

    const grid = gridFromQuote(quote);
    const rng = mulberry32((seed ^ 0x5bf03635) >>> 0);
    const cellsPerAnswer = assignCells(grid, answers, rng);

    const entries: Entry[] = answers.map((answer, i) => ({
      label: entryLabel(i),
      answer,
      display: index.display[answer] ?? answer.toLowerCase(),
      cells: cellsPerAnswer[i],
      coords: cellsPerAnswer[i].map((cell) => cellCoord(grid.width, cell)),
      clue: "",
    }));

    return { id, seed, daily, grid, entries, quote };
  }
  return null;
}
