import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCart } from "@/store/cart";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils";
import { buildProductMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { useContacts } from "@/services/useContacts";
import { useSeo } from "@/lib/seo";
import { ProductsRepo } from "@/services/productsRepo";
import { PrefetchLink } from "@/routes/PrefetchLink";
import { useFragrances } from "@/services/useFragrances";

export function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { toast } = useToast();
  const { data: contacts } = useContacts();
  const fragrancesQuery = useFragrances();
  const [activeImage, setActiveImage] = React.useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [selectedVariant, setSelectedVariant] = React.useState("");
  const [selectedFragrance, setSelectedFragrance] = React.useState("");

  React.useEffect(() => {
    if (!isPreviewOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewOpen]);

  const productQuery = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id) return null;
      const byId = await ProductsRepo.getById(id);
      if (byId) return byId;
      return ProductsRepo.getBySlug(id);
    }
  });

  const product = productQuery.data;
  const availableVariants = React.useMemo(
    () =>
      Array.from(
        new Set((product?.variants ?? []).map((item) => item.trim()).filter(Boolean))
      ),
    [product?.variants]
  );
  const requiresVariant = availableVariants.length > 0;
  const availableFragrances = fragrancesQuery.data ?? [];
  const requiresFragrance = availableFragrances.length > 0;
  const canAddToCart = product
    ? (!requiresVariant || Boolean(selectedVariant)) && (!requiresFragrance || Boolean(selectedFragrance))
    : false;

  React.useEffect(() => {
    setSelectedVariant("");
    setSelectedFragrance("");
  }, [product?.id]);

  useSeo({
    title: product?.name ?? "Produto",
    description: product?.description ?? "Detalhes do produto EncantArtes."
  });

  const handleAdd = () => {
    if (!product) return;
    if (requiresVariant && !selectedVariant) {
      toast({
        title: "Selecione uma variação",
        description: "Escolha a cor/variação antes de adicionar ao carrinho.",
        variant: "error"
      });
      return;
    }
    if (requiresFragrance && !selectedFragrance) {
      toast({
        title: "Selecione uma fragrância",
        description: "Escolha a fragrância antes de adicionar ao carrinho.",
        variant: "error"
      });
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      variant: selectedVariant || undefined,
      fragrance: selectedFragrance || undefined,
      quantity: 1
    });
    toast({
      title: "Adicionado ao carrinho",
      description: [product.name, selectedVariant, selectedFragrance].filter(Boolean).join(" - "),
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
    buildProductMessage(product, {
      variant: selectedVariant || undefined,
      fragrance: selectedFragrance || undefined
    })
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
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="glass-panel group relative block w-full cursor-zoom-in overflow-hidden p-0 text-left"
            aria-label="Abrir imagem ampliada"
          >
            <img
              src={product.images[activeImage]}
              alt={product.name}
              className="h-[520px] w-full bg-white/40 object-contain md:h-[560px]"
              loading="eager"
              decoding="async"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/15 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-700 opacity-0 shadow-soft transition group-hover:opacity-100">
              Ampliar
            </span>
          </button>
          <div className="mt-4 flex flex-wrap gap-3">
            {product.images.map((image, index) => (
              <button
                key={image}
                onClick={() => setActiveImage(index)}
                className={`h-24 w-24 overflow-hidden rounded-2xl border transition sm:h-28 sm:w-28 ${
                  index === activeImage
                    ? "border-gold-500 ring-2 ring-gold-300"
                    : "border-sand-200/70 hover:border-sand-300"
                }`}
                aria-label={`Imagem ${index + 1}`}
              >
                <img
                  src={image}
                  alt=""
                  className="h-full w-full bg-white/40 object-contain p-1"
                  loading="lazy"
                />
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
              <p className="text-2xl font-semibold text-ink-900">{formatCurrency(product.price)}</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                {product.inStock ? "Em estoque" : "Sob encomenda"}
              </span>
            </div>
          </div>
          {requiresVariant ? (
            <div className="space-y-2">
              <Label>Cor / variação (obrigatório)</Label>
              <div className="flex flex-wrap gap-2">
                {availableVariants.map((variant) => {
                  const isSelected = selectedVariant === variant;
                  return (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        isSelected
                          ? "border-gold-500 bg-gold-100 text-ink-900 ring-2 ring-gold-200"
                          : "border-sand-200/70 bg-white/80 text-ink-700 hover:border-sand-300"
                      }`}
                      aria-pressed={isSelected}
                    >
                      {variant}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-500">
                Escolha uma opção para liberar os botões de compra.
              </p>
            </div>
          ) : null}
          {requiresFragrance ? (
            <div className="space-y-2">
              <Label>Fragrância (obrigatório)</Label>
              <div className="flex flex-wrap gap-2">
                {availableFragrances.map((fragrance) => {
                  const isSelected = selectedFragrance === fragrance.name;
                  return (
                    <button
                      key={fragrance.id}
                      type="button"
                      onClick={() => setSelectedFragrance(fragrance.name)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        isSelected
                          ? "border-gold-500 bg-gold-100 text-ink-900 ring-2 ring-gold-200"
                          : "border-sand-200/70 bg-white/80 text-ink-700 hover:border-sand-300"
                      }`}
                      aria-pressed={isSelected}
                    >
                      {fragrance.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-500">
                Escolha uma fragrância para liberar os botões de compra.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleAdd} disabled={!product.inStock || !canAddToCart}>
              <ShoppingBag className="h-4 w-4" />
              Adicionar ao carrinho
            </Button>
            {canAddToCart ? (
              <Button asChild variant="outline">
                <a href={whatsappLink} target="_blank" rel="noreferrer">
                  Comprar no WhatsApp
                </a>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Comprar no WhatsApp
              </Button>
            )}
          </div>
        </div>
      </div>

      {isPreviewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização ampliada de ${product.name}`}
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsPreviewOpen(false)}
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/20"
            aria-label="Fechar visualização"
          >
            Fechar
          </button>
          <img
            src={product.images[activeImage]}
            alt={product.name}
            className="max-h-[90vh] max-w-[94vw] rounded-2xl bg-white/10 object-contain p-2 shadow-glow"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
