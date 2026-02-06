import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuantityControl } from "@/components/QuantityControl";
import { useCart } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import { buildCartMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { useContacts } from "@/services/useContacts";
import { useSeo } from "@/lib/seo";
import { PrefetchLink } from "@/routes/PrefetchLink";

export function Cart() {
  useSeo({
    title: "Carrinho",
    description: "Finalize seu pedido com rapidez e carinho pela EncantArtes."
  });

  const { items, subtotal, updateQuantity, removeItem, clear } = useCart();
  const { data: contacts } = useContacts();

  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    buildCartMessage(items, subtotal)
  );

  if (items.length === 0) {
    return (
      <div className="section-shell pb-12 pt-28 text-center">
        <div className="glass-panel mx-auto max-w-lg p-8">
          <p className="text-lg text-ink-700">Seu carrinho está vazio.</p>
          <PrefetchLink
            to="/"
            className="mt-4 inline-flex rounded-full border border-sand-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-white"
          >
            Voltar para a vitrine
          </PrefetchLink>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell pb-12 pt-28">
      <h1 className="font-serif text-3xl text-ink-900">Carrinho</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-24 w-24 rounded-2xl object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="flex-1">
                <p className="font-semibold text-ink-900">{item.name}</p>
                <p className="text-sm text-ink-600">{formatCurrency(item.price)}</p>
              </div>
              <div className="flex items-center gap-4">
                <QuantityControl
                  value={item.quantity}
                  onChange={(value) => updateQuantity(item.productId, value)}
                />
                <Button
                  variant="ghost"
                  onClick={() => removeItem(item.productId)}
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="glass-panel h-fit p-6">
          <p className="text-xs uppercase tracking-wide text-ink-500">Subtotal</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {formatCurrency(subtotal)}
          </p>
          <p className="mt-2 text-sm text-ink-600">
            Revise os itens e conclua seu pedido direto com a equipe EncantArtes.
          </p>
          <Button asChild className="mt-6 w-full">
            <a href={whatsappLink} target="_blank" rel="noreferrer">
              Finalizar no WhatsApp
            </a>
          </Button>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={clear}
            type="button"
          >
            Limpar carrinho
          </Button>
        </div>
      </div>
    </div>
  );
}



