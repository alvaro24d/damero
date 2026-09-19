import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `lib/wordlist.ts` lee estos JSON con `fs` en tiempo de ejecución, y el
  // rastreador de Next no ve las rutas porque se componen con `path.join`.
  // Sin esto, la función desplegada arranca sin diccionario y revienta.
  outputFileTracingIncludes: {
    "/**": ["./data/wordlist.json", "./data/word-forms.json", "./data/quotes.json"],
  },
  // El .dic, el .aff y el corpus de frecuencias solo los usa
  // `scripts/build-wordlist.ts`; en producción son peso muerto.
  outputFileTracingExcludes: {
    "/**": [
      "./data/es_ES.dic",
      "./data/es_ES.aff",
      "./data/es_freq.txt",
      "./data/blocklist.txt",
    ],
  },
};

export default nextConfig;
