/**
 * Definiciones de las respuestas, escritas por Claude.
 *
 * Es lo único del damero que sale a la red, así que va en una sola llamada con
 * todas las palabras: cuarenta peticiones sueltas costarían cuarenta veces la
 * latencia y casi lo mismo en tokens de entrada.
 *
 * La palabra se manda con su forma acentuada ("ACCION (acción)") porque sin la
 * tilde el modelo no siempre acierta con cuál de las dos palabras es, y una
 * definición de "papá" para PAPA arruina el pasatiempo.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { Entry } from "./types.ts";

/**
 * Generación anterior a la que está en el pliego original (`claude-sonnet-4-6`):
 * Sonnet 5 es más reciente y más barato ($2/$10 por millón de tokens frente a
 * $3/$15). Se puede cambiar con DAMERO_MODEL sin tocar el código.
 */
const MODEL = process.env.DAMERO_MODEL ?? "claude-sonnet-5";

const DefinitionsSchema = z.object({
  definiciones: z.array(
    z.object({
      palabra: z.string(),
      definicion: z.string(),
    }),
  ),
});

const SYSTEM = `Eres el redactor de pasatiempos de un periódico español. Escribes las definiciones de un damero: cada una es la pista de una palabra que el lector tiene que adivinar.

Reglas de cada definición:
- En español de España, una sola frase breve (de dos a ocho palabras), sin punto final.
- No uses la palabra definida ni ninguna palabra de su misma familia léxica.
- No menciones cuántas letras tiene ni des pistas sobre su ortografía.
- Empieza en mayúscula.
- Si la respuesta es una forma verbal conjugada, dilo con naturalidad, como en la prensa: "Cortaron, en pasado", "Salgas de allí".
- Si es un plural, defínela en plural.
- Prefiere el sentido más corriente de la palabra. Solo si la palabra es rara, admite una definición de diccionario.
- Nada de referencias a personas reales vivas ni a marcas.

Devuelve una definición para CADA palabra de la lista, sin saltarte ninguna y sin añadir palabras que no estén.`;

/**
 * Devuelve `respuesta -> definición` para todas las palabras del damero.
 * Sin `ANTHROPIC_API_KEY` no falla: deja las definiciones marcadas como
 * ausentes, para poder desarrollar la interfaz sin gastar llamadas.
 */
export async function generateClues(entries: Entry[]): Promise<Record<string, string>> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Object.fromEntries(
      entries.map((entry) => [entry.answer, "(falta ANTHROPIC_API_KEY)"]),
    );
  }

  const client = new Anthropic();

  // "ACCION (acción)" cuando la tilde aporta algo; si no, la palabra sola.
  const list = entries
    .map((entry) => {
      const accented = entry.display.toUpperCase() === entry.answer ? "" : ` (${entry.display})`;
      return `${entry.answer}${accented}`;
    })
    .join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: {
      format: zodOutputFormat(DefinitionsSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: `Escribe la definición de cada una de estas ${entries.length} palabras:\n\n${list}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `El modelo rechazó la petición (${response.stop_details?.category ?? "sin categoría"}).`,
    );
  }

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("La respuesta del modelo no se pudo interpretar.");

  const clues: Record<string, string> = {};
  for (const { palabra, definicion } of parsed.definiciones) {
    clues[palabra.trim().toUpperCase()] = definicion.trim();
  }
  return clues;
}

/**
 * Pega las definiciones a sus entradas. Si alguna falta —el modelo se saltó una
 * palabra— se deja constancia en la propia pista en vez de dejar el hueco en
 * blanco, que sería indistinguible de un fallo de la interfaz.
 */
export function attachClues(entries: Entry[], clues: Record<string, string>): Entry[] {
  return entries.map((entry) => ({
    ...entry,
    clue: clues[entry.answer] ?? `Definición no disponible (${entry.answer.length} letras)`,
  }));
}
