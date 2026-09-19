/**
 * Construye la lista de palabras que usa el damero a partir del diccionario
 * Hunspell es_ES.
 *
 * Tres pasos, cada uno por una razón concreta:
 *
 *  1. EXPANDIR. El .dic solo trae formas base. Una cita española está llena
 *     de plurales y de verbos conjugados, y el damero tiene que repartir
 *     exactamente esas letras entre las respuestas: sin las eses de plural el
 *     reparto no cuadra nunca. Aplicamos las reglas del .aff.
 *  2. FILTRAR POR USO. La expansión da cientos de miles de formas, muchas
 *     impronunciables. Cruzamos con una lista de frecuencias reales
 *     (OpenSubtitles) y nos quedamos con lo que alguien reconocería.
 *  3. ORDENAR POR FRECUENCIA. Así el rellenador prueba primero lo común y el
 *     damero resultante se puede definir sin retorcimientos.
 *
 * Uso:  node scripts/build-wordlist.ts [--min-freq 100] [--min 3] [--max 12]
 *
 * Genera:
 *   data/wordlist.json    { "3": ["AJO", ...], ... }  mayúsculas sin tildes, por frecuencia desc.
 *   data/word-forms.json  { "ACCION": "acción", ... } forma con tildes (solo si difiere)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expand, parseAff } from "./hunspell.ts";

// --- Argumentos -----------------------------------------------------------

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const DIC_FILE = resolve(process.cwd(), arg("in", "data/es_ES.dic"));
const AFF_FILE = resolve(process.cwd(), arg("aff", "data/es_ES.aff"));
const FREQ_FILE = resolve(process.cwd(), arg("freq", "data/es_freq.txt"));
const BLOCK_FILE = resolve(process.cwd(), arg("blocklist", "data/blocklist.txt"));
const OUT_WORDS = resolve(process.cwd(), arg("out", "data/wordlist.json"));
const OUT_FORMS = resolve(process.cwd(), arg("forms", "data/word-forms.json"));
const MIN_LEN = Number(arg("min", "3"));
const MAX_LEN = Number(arg("max", "12"));
/** Ocurrencias mínimas en el corpus para aceptar una palabra. */
const MIN_FREQ = Number(arg("min-freq", "100"));
/** Candidatas mínimas por letra inicial (el acróstico las impone). */
const MIN_PER_INITIAL = Number(arg("min-per-initial", "60"));

const FREQ_URL =
  "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_full.txt";

// --- Normalización --------------------------------------------------------

/** Letras admitidas en una forma válida (minúsculas). */
const ALLOWED = /^[a-záéíóúüñ]+$/;

/** Tildes y diéresis -> letra base. La Ñ se conserva: es una letra propia. */
const DEACCENT: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
};

/** "acción" -> "ACCION". */
function normalize(word: string): string {
  let out = "";
  for (const ch of word) out += DEACCENT[ch] ?? ch;
  return out.toUpperCase();
}

// --- Lista negra ----------------------------------------------------------

const blocked = new Set<string>();
const blockedPatterns: RegExp[] = [];
if (existsSync(BLOCK_FILE)) {
  for (const line of readFileSync(BLOCK_FILE, "utf8").split(/\r?\n/)) {
    const entry = line.split("#")[0].trim();
    if (!entry) continue;
    if (entry.startsWith("re:")) blockedPatterns.push(new RegExp(entry.slice(3)));
    else blocked.add(entry.toUpperCase());
  }
}

function isBlocked(word: string): boolean {
  return blocked.has(word) || blockedPatterns.some((re) => re.test(word));
}

// --- Frecuencias ----------------------------------------------------------

/** Descarga el corpus de frecuencias la primera vez (~14 MB, no se versiona). */
async function ensureFreqFile(): Promise<void> {
  if (existsSync(FREQ_FILE)) return;
  console.log(`Descargando lista de frecuencias -> ${FREQ_FILE}`);
  const res = await fetch(FREQ_URL);
  if (!res.ok) throw new Error(`No se pudo descargar ${FREQ_URL}: ${res.status}`);
  writeFileSync(FREQ_FILE, Buffer.from(await res.arrayBuffer()));
}

await ensureFreqFile();

/**
 * normalizada -> ocurrencias en el corpus.
 *
 * Guardamos también por debajo de MIN_FREQ, con un suelo bajo, porque las
 * iniciales escasas (Ñ, X, W) necesitan rescatar palabras poco frecuentes.
 * Las variantes con tilde suman al mismo contador ("sé" y "se" -> "SE").
 */
const FREQ_FLOOR = Math.min(MIN_FREQ, 20);

/** Iniciales con tan pocas palabras que no admiten filtro de frecuencia. */
const SCARCE_INITIALS = new Set(["Ñ", "X", "W", "K", "Y", "Z", "Q", "U"]);
const freq = new Map<string, number>();
for (const line of readFileSync(FREQ_FILE, "utf8").split("\n")) {
  const sep = line.indexOf(" ");
  if (sep === -1) continue;
  const count = Number(line.slice(sep + 1));
  if (!(count >= FREQ_FLOOR)) continue;
  const word = line.slice(0, sep);
  if (!ALLOWED.test(word)) continue;
  const norm = normalize(word);
  freq.set(norm, (freq.get(norm) ?? 0) + count);
}

// --- Expansión del diccionario -------------------------------------------

const aff = parseAff(readFileSync(AFF_FILE, "utf8"));

const stats = {
  entradas: 0,
  propias: 0, // nombres propios y siglas (empiezan por mayúscula)
  formas: 0, // formas generadas por la expansión
  aceptadas: 0,
  bloqueadas: 0,
  rescatadas: 0,
};

/**
 * Una línea del .dic es `palabra/BANDERAS`, con campos morfológicos opcionales
 * tras un tabulador. La barra escapada forma parte de la palabra.
 */
function parseEntry(line: string): { word: string; flags: string } {
  const base = line.split("\t")[0].trim();
  let word = "";
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (ch === "\\") {
      word += base[++i] ?? "";
      continue;
    }
    if (ch === "/") return { word, flags: base.slice(i + 1) };
    word += ch;
  }
  return { word, flags: "" };
}

/** normalizada -> forma con tildes preferida */
const forms = new Map<string, string>();
/** normalizada -> descartadas por frecuencia, agrupadas por inicial */
const spare = new Map<string, string[]>();

const dicLines = readFileSync(DIC_FILE, "utf8").split(/\r?\n/);
// La primera línea de un .dic es el número de entradas, no una palabra.
if (/^\d+$/.test(dicLines[0]?.trim() ?? "")) dicLines.shift();

for (const line of dicLines) {
  if (!line.trim() || line.startsWith("#")) continue;
  stats.entradas++;

  const { word, flags } = parseEntry(line);
  if (!word) continue;

  // Nombres propios y siglas: "Abel", "ADN", "ADSL".
  if (word[0] !== word[0].toLowerCase()) {
    stats.propias++;
    continue;
  }

  for (const form of expand(word, flags, aff)) {
    stats.formas++;
    if (!ALLOWED.test(form)) continue;

    const norm = normalize(form);
    if (norm.length < MIN_LEN || norm.length > MAX_LEN) continue;
    if (forms.has(norm)) {
      // Ante "papa" y "papá" preferimos como canónica la forma sin tilde.
      if (form === norm.toLowerCase()) forms.set(norm, form);
      continue;
    }
    if (isBlocked(norm)) {
      stats.bloqueadas++;
      continue;
    }

    const count = freq.get(norm) ?? 0;
    if (count < MIN_FREQ) {
      // Para las iniciales escasas guardamos incluso lo que el corpus no
      // registra: si no, el acróstico se queda sin palabras que empiecen por Ñ.
      if (count >= FREQ_FLOOR || SCARCE_INITIALS.has(norm[0])) {
        const bucket = spare.get(norm[0]);
        if (bucket) bucket.push(norm);
        else spare.set(norm[0], [norm]);
      }
      continue;
    }

    forms.set(norm, form);
    stats.aceptadas++;
  }
}

// --- Cuota por inicial ----------------------------------------------------

// En el damero acróstico cada definición empieza por una letra impuesta por el
// autor y el título, así que ninguna inicial puede quedarse sin candidatos.
// La Ñ, la X y la W apenas tienen palabras: para ellas recuperamos las más
// frecuentes de las descartadas hasta llegar a la cuota.
const counts = new Map<string, number>();
for (const word of forms.keys()) counts.set(word[0], (counts.get(word[0]) ?? 0) + 1);

for (const [initial, candidates] of spare) {
  const missing = MIN_PER_INITIAL - (counts.get(initial) ?? 0);
  if (missing <= 0) continue;
  const unique = [...new Set(candidates)].filter((w) => !forms.has(w));
  unique.sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.localeCompare(b));
  for (const word of unique.slice(0, missing)) {
    forms.set(word, word.toLowerCase());
    stats.rescatadas++;
  }
}

// --- Salida ---------------------------------------------------------------

const kept = [...forms.keys()];
// Más frecuente primero; a igualdad, alfabético (determinismo entre ejecuciones).
kept.sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.localeCompare(b));

const byLength: Record<string, string[]> = {};
for (const word of kept) (byLength[word.length] ??= []).push(word);

const accented: Record<string, string> = {};
for (const word of kept) {
  const form = forms.get(word)!;
  if (form.toUpperCase() !== word) accented[word] = form;
}

writeFileSync(OUT_WORDS, JSON.stringify(byLength), "utf8");
writeFileSync(OUT_FORMS, JSON.stringify(accented), "utf8");

// --- Informe --------------------------------------------------------------

console.log(`Entradas del .dic:        ${stats.entradas}`);
console.log(`  nombres propios/siglas: ${stats.propias}`);
console.log(`Formas tras expandir:     ${stats.formas}`);
console.log(`  en la lista negra:      ${stats.bloqueadas}`);
console.log(`  rescatadas por inicial: ${stats.rescatadas}`);
console.log(`Palabras finales:         ${kept.length}`);
console.log(`Con tilde o diéresis:     ${Object.keys(accented).length}`);
console.log("");
console.log("Longitud   palabras   más frecuentes");
for (const len of Object.keys(byLength)
  .map(Number)
  .sort((a, b) => a - b)) {
  const list = byLength[len];
  console.log(
    `  ${String(len).padStart(2)}      ${String(list.length).padStart(6)}   ${list.slice(0, 6).join(", ")}`,
  );
}

const byInitial = new Map<string, number>();
for (const word of kept) byInitial.set(word[0], (byInitial.get(word[0]) ?? 0) + 1);
console.log("");
console.log("Palabras por inicial:");
console.log(
  [..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"]
    .map((ch) => `${ch}:${byInitial.get(ch) ?? 0}`)
    .join("  "),
);
