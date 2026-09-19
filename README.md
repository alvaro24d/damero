# Damero

Un damero mágico nuevo cada día. La cuadrícula esconde una frase célebre; se
descifra resolviendo definiciones cuyas letras están repartidas por casillas
sueltas, y las iniciales de las respuestas deletrean el autor y la obra.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # y pega tu ANTHROPIC_API_KEY
npm run dev
```

Sin clave de API la aplicación arranca igual, pero las definiciones aparecen
como `(falta ANTHROPIC_API_KEY)`: sirve para trastear con la interfaz sin gastar
llamadas.

Los datos generados (`data/wordlist.json`, `data/word-forms.json`) están en el
repositorio, así que no hace falta regenerarlos para arrancar.

## Cómo funciona

```
fecha (Europe/Madrid) -> semilla -> frase -> retícula -> reparto de letras -> definiciones
```

Todo se deriva de la fecha, así que el damero cambia solo a medianoche: no hay
base de datos, ni cron, ni estado en el servidor. El damero completo del día se
cachea con `unstable_cache` (`revalidate: 86400`), de modo que la API de Claude
se llama una vez por damero.

### Las piezas

| Fichero | Qué hace |
| --- | --- |
| `lib/seed.ts` | Semilla diaria y generador pseudoaleatorio (mulberry32) |
| `lib/quote.ts` | Normaliza la frase, la maqueta en la cuadrícula y valida el repertorio |
| `lib/acrostic-filler.ts` | Reparte las letras de la frase entre las definiciones |
| `lib/damero.ts` | Ensambla retícula, reparto y coordenadas |
| `lib/clue-generator.ts` | Pide las definiciones a Claude en una sola llamada |
| `lib/daily.ts` | La capa de caché |
| `components/` | Tablero, cuadrícula, claves y barra de ayudas |

### El reparto de letras

Es la parte difícil. La frase aporta un multiconjunto exacto de letras y el
acróstico dice cuántas respuestas hay y por qué letra empieza cada una; hay que
partir ese multiconjunto en palabras reales sin que sobre ni falte ninguna.

Se resuelve con búsqueda local por mínimos conflictos, no con backtracking: un
reparto puede ir bien treinta palabras y ser imposible por la última letra, y
descubrirlo al final obliga a deshacerlo casi todo. Las 17 frases del repertorio
se resuelven en menos de un segundo cada una.

## Añadir frases

Edita `data/quotes.json` y comprueba el repertorio:

```bash
npm run quotes            # informe de todas las frases
npm run quotes <id>       # dibuja la retícula de una
npm run damero            # genera el damero de hoy por consola
npm run damero -- --all   # comprueba que todas las frases tienen reparto
```

Una frase sirve si cumple dos condiciones, y el informe avisa cuando no:

1. **Proporción.** Entre 4,5 y 7,5 letras de frase por cada letra del acróstico.
   Con menos, todas las respuestas tendrían tres letras; con más, no hay
   palabras tan largas.
2. **Cobertura de letras.** Cada letra del acróstico es la inicial de una
   respuesta y acaba en la cuadrícula, así que la frase tiene que contener al
   menos tantas copias de esa letra como pida el acróstico. Es lo que hace
   irresoluble "Don Quijote" con el arranque de la novela: el título exige una
   jota que la cita no tiene.

## Regenerar el diccionario

Solo hace falta si cambias los filtros o la lista negra:

```bash
npm run wordlist
```

Parte de `data/es_ES.dic` y `data/es_ES.aff` (Hunspell es_ES), expande los
afijos para obtener plurales y conjugaciones, y cruza el resultado con una lista
de frecuencias de uso que se descarga sola la primera vez (~14 MB, no se
versiona). Para afinar qué palabras entran, edita `data/blocklist.txt`.

## Despliegue

Vercel sin más configuración. Define `ANTHROPIC_API_KEY` en las variables de
entorno del proyecto.
