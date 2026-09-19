/**
 * Expansión de afijos Hunspell.
 *
 * El .dic solo trae formas base: "casa", "hablar", "grande". Las que aparecen
 * de verdad en una frase — plurales y conjugaciones — están codificadas en las
 * banderas de cada entrada y en las reglas del .aff. Sin expandirlas, el
 * reparto de letras del damero es imposible: una cita española está llena de
 * eses de plural que ninguna forma base puede absorber.
 *
 * Se implementa lo que usa el diccionario es_ES y nada más: SFX, PFX,
 * producto cruzado y un segundo nivel de sufijos vía banderas de continuación.
 * No hay palabras compuestas, ni alias de banderas (AF), ni CIRCUMFIX.
 */

export interface AffixRule {
  /** Letras que se quitan del extremo ("0" en el fichero = ninguna). */
  strip: string;
  /** Letras que se añaden. */
  add: string;
  /** Banderas que hereda la forma resultante (sufijos de segundo nivel). */
  continuation: string[];
  /** Condición sobre el extremo correspondiente de la raíz. */
  condition: RegExp;
}

export interface AffixTable {
  prefixes: Map<string, AffixRule[]>;
  suffixes: Map<string, AffixRule[]>;
  /** Banderas que admiten combinarse prefijo + sufijo. */
  crossProduct: Set<string>;
  /** Todas las banderas declaradas, para poder trocear la cadena del .dic. */
  flags: Set<string>;
}

/**
 * Trocea una línea en campos separados por espacios, ignorando los comentarios
 * y los campos morfológicos que van después de la condición.
 */
function fields(line: string): string[] {
  return line.split("#")[0].trim().split(/\s+/);
}

export function parseAff(text: string): AffixTable {
  const prefixes = new Map<string, AffixRule[]>();
  const suffixes = new Map<string, AffixRule[]>();
  const crossProduct = new Set<string>();
  const flags = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("SFX") && !line.startsWith("PFX")) continue;
    const parts = fields(line);
    const [kind, flag] = parts;
    const isSuffix = kind === "SFX";
    const table = isSuffix ? suffixes : prefixes;

    // Cabecera de bloque: "SFX S Y 31".
    if ((parts[2] === "Y" || parts[2] === "N") && /^\d+$/.test(parts[3] ?? "")) {
      flags.add(flag);
      if (parts[2] === "Y") crossProduct.add(flag);
      if (!table.has(flag)) table.set(flag, []);
      continue;
    }

    // Regla: "SFX S 0 es [bdhíjlrúxy]".
    const strip = parts[2] === "0" ? "" : parts[2];
    const [addRaw, contRaw] = (parts[3] ?? "0").split("/");
    const add = addRaw === "0" ? "" : addRaw;
    const cond = parts[4] ?? ".";

    const rule: AffixRule = {
      strip,
      add,
      continuation: contRaw ? [...contRaw] : [],
      condition: new RegExp(isSuffix ? `${cond}$` : `^${cond}`),
    };

    const rules = table.get(flag);
    if (rules) rules.push(rule);
    else table.set(flag, [rule]);
  }

  return { prefixes, suffixes, crossProduct, flags };
}

/**
 * Trocea la cadena de banderas de una entrada del .dic.
 *
 * Con `FLAG UTF-8` cada bandera es un carácter, pero este diccionario usa
 * algún emoji cuya representación ocupa dos puntos de código. Emparejamos
 * primero las banderas largas conocidas para no partirlas por la mitad.
 */
export function splitFlags(raw: string, known: Set<string>): string[] {
  const long = [...known].filter((f) => [...f].length > 1).sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    const match = long.find((f) => raw.startsWith(f, i));
    if (match) {
      out.push(match);
      i += match.length;
      continue;
    }
    const cp = String.fromCodePoint(raw.codePointAt(i)!);
    out.push(cp);
    i += cp.length;
  }
  return out;
}

function applySuffix(stem: string, rule: AffixRule): string | null {
  if (!rule.condition.test(stem)) return null;
  if (rule.strip && !stem.endsWith(rule.strip)) return null;
  return stem.slice(0, stem.length - rule.strip.length) + rule.add;
}

function applyPrefix(stem: string, rule: AffixRule): string | null {
  if (!rule.condition.test(stem)) return null;
  if (rule.strip && !stem.startsWith(rule.strip)) return null;
  return rule.add + stem.slice(rule.strip.length);
}

/**
 * Todas las formas de una entrada: la base, sus sufijos (hasta dos niveles),
 * sus prefijos y las combinaciones de ambos.
 */
export function expand(word: string, flagString: string, aff: AffixTable): string[] {
  const forms = new Set<string>([word]);
  if (!flagString) return [...forms];

  const flags = splitFlags(flagString, aff.flags);

  /** Formas con un sufijo, y si la bandera admite producto cruzado. */
  const suffixed: { form: string; cross: boolean }[] = [];

  for (const flag of flags) {
    for (const rule of aff.suffixes.get(flag) ?? []) {
      const form = applySuffix(word, rule);
      if (form === null) continue;
      forms.add(form);
      suffixed.push({ form, cross: aff.crossProduct.has(flag) });

      // Segundo nivel: "hablar" -> "habla/S" -> "hablas".
      for (const next of rule.continuation) {
        for (const nextRule of aff.suffixes.get(next) ?? []) {
          const form2 = applySuffix(form, nextRule);
          if (form2 !== null) forms.add(form2);
        }
      }
    }
  }

  for (const flag of flags) {
    const cross = aff.crossProduct.has(flag);
    for (const rule of aff.prefixes.get(flag) ?? []) {
      const base = applyPrefix(word, rule);
      if (base === null) continue;
      forms.add(base);
      if (!cross) continue;
      for (const { form, cross: suffixCross } of suffixed) {
        if (!suffixCross) continue;
        const combined = applyPrefix(form, rule);
        if (combined !== null) forms.add(combined);
      }
    }
  }

  return [...forms];
}
