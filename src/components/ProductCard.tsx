import { ShoppingBag } from "lucide-react";
import { PrefetchLink } from "@/routes/PrefetchLink";
import { useCart } from "@/store/cart";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, clampText } from "@/lib/utils";
import type { Product } from "@/types/product";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { toast } = useToast();

  const handleAdd = () => {
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

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-sand-200/70 bg-white/80 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-soft">
      <PrefetchLink to={`/produto/${product.id}`} className="block">
        <div className="relative overflow-hidden">
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-52 w-full object-cover transition duration-700 group-hover:scale-110"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/45 via-transparent to-transparent" />
          {product.featured ? (
            <Badge className="absolute left-4 top-4 border-none bg-gold-500 text-ink-900 shadow-soft">
              Destaque
            </Badge>
          ) : null}
        </div>
      </PrefetchLink>
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-500">{product.category}</p>
          <h3 className="mt-2 font-serif text-xl text-ink-900">{product.name}</h3>
          <p className="mt-2 text-sm text-ink-600">{clampText(product.description, 90)}</p>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-lg font-semibold text-ink-900">
            {formatCurrency(product.price)}
          </span>
          <Button size="sm" onClick={handleAdd} disabled={!product.inStock}>
            <ShoppingBag className="h-4 w-4" />
            {product.inStock ? "Adicionar" : "Indisponível"}
          </Button>
        </div>
      </div>
    </div>
  );
}
