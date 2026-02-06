import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCart } from "@/store/cart";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { buildProductMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { useContacts } from "@/services/useContacts";
import { useSeo } from "@/lib/seo";
import { ProductRepoLocal } from "@/services/productRepoLocal";
import { PrefetchLink } from "@/routes/PrefetchLink";

export function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { toast } = useToast();
  const { data: contacts } = useContacts();
  const [activeImage, setActiveImage] = React.useState(0);

  const productQuery = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id) return null;
      const byId = await ProductRepoLocal.getById(id);
      if (byId) return byId;
      return ProductRepoLocal.getBySlug(id);
    }
  });

  const product = productQuery.data;

  useSeo({
    title: product?.name ?? "Produto",
    description: product?.description ?? "Detalhes do produto EncantArtes."
  });

  const handleAdd = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      quantity: 1
    });
    toast({
      title: "Adicionado ao carrinho",
      description: product.name,
      variant: "success"
    });
  };

  if (productQuery.isLoading) {
    return (
      <div className="section-shell pb-12 pt-28">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="section-shell pb-12 pt-28 text-center">
        <p className="text-lg text-ink-700">Produto não encontrado.</p>
        <PrefetchLink
          to="/"
          className="mt-4 inline-flex rounded-full border border-sand-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-white"
        >
          Voltar para a vitrine
        </PrefetchLink>
      </div>
    );
  }

  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    buildProductMessage(product)
  );

  return (
    <div className="section-shell pb-12 pt-28">
      <PrefetchLink
        to="/"
        className="inline-flex items-center gap-2 rounded-full border border-sand-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </PrefetchLink>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="glass-panel overflow-hidden p-0">
            <img
              src={product.images[activeImage]}
              alt={product.name}
              className="h-[420px] w-full object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="mt-4 flex gap-3">
            {product.images.map((image, index) => (
              <button
                key={image}
                onClick={() => setActiveImage(index)}
                className={`h-20 w-20 overflow-hidden rounded-2xl border transition ${
                  index === activeImage
                    ? "border-gold-500 ring-2 ring-gold-300"
                    : "border-sand-200/70 hover:border-sand-300"
                }`}
                aria-label={`Imagem ${index + 1}`}
              >
                <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <span className="inline-flex items-center rounded-full border border-sand-200/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
            {product.category}
          </span>
          <h1 className="font-serif text-3xl text-ink-900">{product.name}</h1>
          <p className="text-lg text-ink-700">{product.description}</p>
          <div className="glass-panel p-4">
            <div className="flex items-end justify-between gap-4">
              <p className="text-2xl font-semibold text-ink-900">
                {formatCurrency(product.price)}
              </p>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {product.inStock ? "Em estoque" : "Sob encomenda"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleAdd} disabled={!product.inStock}>
              <ShoppingBag className="h-4 w-4" />
              Adicionar ao carrinho
            </Button>
            <Button asChild variant="outline">
              <a href={whatsappLink} target="_blank" rel="noreferrer">
                Comprar no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



