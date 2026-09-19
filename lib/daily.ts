/**
 * El damero listo para jugar: retícula, reparto y definiciones, cacheado.
 *
 * Por qué se cachea el damero entero y no solo las pistas: la retícula y el
 * reparto son deterministas a partir de la semilla, pero las definiciones no
 * —Claude no escribe dos veces lo mismo—, así que si se regenerasen a media
 * mañana el jugador vería cambiar las claves de un damero a medio resolver.
 * Guardando el conjunto completo, un día es un damero y punto.
 *
 * Por qué `unstable_cache` y no la directiva `use cache` de Next 16, que es su
 * sustituta: `use cache` guarda en memoria del proceso y sus entradas no
 * sobreviven a un despliegue, así que en un entorno sin servidor cada arranque
 * en frío repetiría la llamada a la API. `unstable_cache` sí persiste entre
 * despliegues —lo dice la propia documentación de `use cache`— y no obliga a
 * activar Cache Components. Está marcado como obsoleto: el día que haga falta
 * migrar, son tres líneas y un `cacheLife("max")`.
 */

import { unstable_cache } from "next/cache";

import { attachClues, generateClues } from "./clue-generator.ts";
import { buildDamero } from "./damero.ts";
import { seedFromKey } from "./seed.ts";
import { loadQuotes, loadWordIndex } from "./wordlist.ts";
import type { Damero } from "./types.ts";

/** Un día. La clave de caché ya rota sola, así que esto es solo el techo. */
const ONE_DAY = 86_400;

async function build(seed: number, id: string, daily: boolean): Promise<Damero> {
  const damero = buildDamero(loadQuotes(), loadWordIndex(), seed, id, daily);
  if (!damero) {
    throw new Error(
      `Ninguna frase del repertorio admite reparto con la semilla ${seed}. ` +
        "Revisa data/quotes.json con `npm run quotes`.",
    );
  }
  const clues = await generateClues(damero.entries);
  return { ...damero, entries: attachClues(damero.entries, clues) };
}

/** Damero del día. `dateKey` es "AAAAMMDD" y es lo que rota la caché. */
export const getDailyDamero = unstable_cache(
  (dateKey: string) => build(seedFromKey(dateKey), dateKey, true),
  ["damero-diario"],
  { revalidate: ONE_DAY },
);

/** Damero de práctica. Volver a la misma URL devuelve el mismo damero. */
export const getPracticeDamero = unstable_cache(
  (seed: number) => build(seed, `practica-${seed}`, false),
  ["damero-practica"],
  { revalidate: ONE_DAY },
);
