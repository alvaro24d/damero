/**
 * Semilla diaria y generador pseudoaleatorio determinista.
 *
 * Todo el damero (retícula, relleno y orden de las claves) se deriva de un
 * único número. Misma semilla -> mismo damero, sin base de datos ni cron:
 * basta con derivarla de la fecha en Madrid para que cambie a medianoche.
 */

/** Zona horaria que manda sobre el cambio de damero. */
export const TIMEZONE = "Europe/Madrid";

/**
 * Fecha actual en Madrid como "AAAAMMDD".
 *
 * `en-CA` da el formato ISO (2026-09-19) en todos los entornos, así que
 * quitando los guiones tenemos la clave del día sin depender de librerías.
 */
export function dailyKey(now: Date = new Date()): string {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return iso.replaceAll("-", "");
}

/**
 * Convierte una clave de texto en una semilla de 32 bits (FNV-1a).
 *
 * Usar el "20260919" pelado como semilla daría retículas casi idénticas en
 * días consecutivos, porque mulberry32 parte de números muy próximos.
 * El hash dispersa esos valores.
 */
export function seedFromKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Semilla del damero del día. */
export function dailySeed(now: Date = new Date()): number {
  return seedFromKey(dailyKey(now));
}

/** Devuelve números en [0, 1). Implementación de mulberry32. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero en [min, max], ambos incluidos. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Fisher-Yates sobre una copia: no toca el array original. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Semilla aleatoria para el modo práctica ("Nuevo damero aleatorio").
 * No depende de la fecha, así que no interfiere con el damero del día.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** "20260919" -> "sábado, 19 de septiembre de 2026". */
export function formatDayKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(4, 6));
  const day = Number(key.slice(6, 8));
  // Mediodía UTC: evita que el desfase horario mueva la fecha un día.
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
