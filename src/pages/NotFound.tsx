import { PrefetchLink } from "@/routes/PrefetchLink";
import { useSeo } from "@/lib/seo";

export function NotFound() {
  useSeo({
    title: "Página não encontrada",
    description: "A página solicitada não foi encontrada."
  });

  return (
    <div className="section-shell pb-12 pt-28 text-center">
      <div className="glass-panel mx-auto max-w-xl p-8">
        <h1 className="font-serif text-3xl text-ink-900">Página não encontrada</h1>
        <p className="mt-2 text-ink-600">Volte para a vitrine e explore nossos produtos.</p>
        <PrefetchLink
          to="/"
          className="mt-4 inline-flex rounded-full border border-sand-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-white"
        >
          Voltar para a home
        </PrefetchLink>
      </div>
    </div>
  );
}


