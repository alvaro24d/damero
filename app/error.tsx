"use client";

/** Pantalla de error: casi siempre, que falta la clave de la API. */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="text-xl font-bold">No se ha podido componer el damero</h1>
      <p className="mt-3 text-sm text-ink-soft">
        Si es la primera vez que lo arrancas, comprueba que <code>ANTHROPIC_API_KEY</code>{" "}
        está definida en <code>.env.local</code>.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-md border border-rule bg-card p-3 text-xs">
        {error.message}
      </pre>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-rule bg-card px-3 py-1.5 text-sm hover:bg-active-soft"
      >
        Reintentar
      </button>
    </main>
  );
}
