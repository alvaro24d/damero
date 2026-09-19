/**
 * Tipos compartidos por el generador, la API y la interfaz.
 *
 * Cómo funciona un damero mágico (acróstico), que es lo que se construye aquí:
 *
 *  1. Se parte de una frase célebre. Sus letras se escriben en la cuadrícula
 *     en orden de lectura; las casillas negras separan las palabras.
 *  2. Cada letra de la frase pertenece a UNA definición y solo a una. Las
 *     definiciones se resuelven aparte y sus letras se copian a las casillas
 *     que indica la clave ("H-4 C-17 B-6..."), repartidas por toda la retícula.
 *  3. Las iniciales de las respuestas, leídas en orden, deletrean el autor y
 *     la obra: ese es el acróstico que da nombre al pasatiempo.
 *
 * Convenciones:
 * - Las celdas se indexan en orden de lectura: `index = row * width + col`.
 * - Las letras van en mayúsculas y sin tildes (ACCION, no acción). La forma
 *   acentuada viaja aparte para enseñarla en la solución.
 * - Las filas se nombran con letras (A, B, C...) y las columnas con números
 *   empezando en 1, de modo que una casilla se cita como "H-4".
 */

/** Una entrada del repertorio de frases (`data/quotes.json`). */
export interface Quote {
  id: string;
  /** Frase tal cual, con tildes y puntuación. */
  text: string;
  author: string;
  /** Obra de la que procede. Junto al autor forma el acróstico. */
  work: string;
}

/** La frase ya preparada para repartirla en la cuadrícula. */
export interface PreparedQuote extends Quote {
  /** Solo letras, en mayúsculas y sin tildes. Una por casilla blanca. */
  letters: string;
  /** AUTOR + OBRA normalizado: una letra por definición. */
  acrostic: string;
}

/** Retícula: geometría y letras de la frase. */
export interface Grid {
  width: number;
  height: number;
  /** `true` = casilla negra. Longitud `width * height`, en orden de lectura. */
  blocks: boolean[];
  /**
   * Letra de la solución en cada casilla, cadena vacía en las negras.
   * Longitud `width * height`.
   */
  solution: string[];
  /**
   * Índices de las casillas blancas en orden de lectura. La posición `i` de
   * este array es la letra `i` de la frase.
   */
  whiteCells: number[];
}

/** Una definición del damero: la unidad que resuelve el jugador. */
export interface Entry {
  /** Etiqueta correlativa: "A", "B", ... "Z", "AA", "AB"... */
  label: string;
  /** Respuesta normalizada (mayúsculas, sin tildes). */
  answer: string;
  /** Forma con tildes para la solución ("ACCION" -> "acción"). */
  display: string;
  /**
   * Índice de celda de cada letra de la respuesta, en orden.
   * `cells[j]` es la casilla donde va `answer[j]`. Longitud = `answer.length`.
   */
  cells: number[];
  /** Las mismas casillas en formato legible: ["H-4", "C-17", ...]. */
  coords: string[];
  /** La definición, generada con la API de Claude. */
  clue: string;
}

/** Un damero completo: lo que devuelve la API y consume la interfaz. */
export interface Damero {
  /** "20260919" para el damero del día; "practice-<seed>" en modo práctica. */
  id: string;
  seed: number;
  /** `true` si es el damero del día (el que se guarda en localStorage). */
  daily: boolean;
  grid: Grid;
  entries: Entry[];
  /** La frase, el autor y la obra: se revelan solo al terminar. */
  quote: Quote;
}

// --- Utilidades de coordenadas -------------------------------------------

/** Fila 0 -> "A", fila 7 -> "H". A partir de la Z sigue con AA, AB... */
export function rowLabel(row: number): string {
  let label = "";
  let n = row;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** Celda (7, 3) -> "H-4". */
export function coordLabel(row: number, col: number): string {
  return `${rowLabel(row)}-${col + 1}`;
}

/** Igual que `rowLabel`, para etiquetar las definiciones: A, B... Z, AA, AB. */
export const entryLabel = rowLabel;

export function cellIndex(width: number, row: number, col: number): number {
  return row * width + col;
}

export function cellRow(width: number, index: number): number {
  return Math.floor(index / width);
}

export function cellCol(width: number, index: number): number {
  return index % width;
}

/** Celda 3 de una retícula de 17 de ancho -> "A-4". */
export function cellCoord(width: number, index: number): string {
  return coordLabel(cellRow(width, index), cellCol(width, index));
}
