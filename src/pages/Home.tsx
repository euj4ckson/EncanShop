import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Filter, Leaf, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/ProductCard";
import { useContacts } from "@/services/useContacts";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useSeo } from "@/lib/seo";
import { PAGE_SIZE } from "@/lib/config";
import { ProductRepoLocal } from "@/services/productRepoLocal";
import { formatCurrency } from "@/lib/utils";
import type { ProductSort } from "@/services/productRepo";
import logo from "@/assets/logo.svg";

export function Home() {
  useSeo({
    title: "Loja",
    description: "EncantArtes: velas artesanais, kits e presentes com charme e aconchego."
  });

  const { data: contacts } = useContacts();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [sort, setSort] = React.useState<ProductSort>("featured");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const featuredQuery = useQuery({
    queryKey: ["featured"],
    queryFn: () => ProductRepoLocal.list({ featured: true, pageSize: 4 })
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => ProductRepoLocal.listCategories()
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ["products", { search, category, sort }],
    queryFn: ({ pageParam = 0 }) =>
      ProductRepoLocal.list({
        search,
        category,
        sort,
        page: pageParam,
        pageSize: PAGE_SIZE
      }),
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * lastPage.pageSize;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    }
  });

  React.useEffect(() => {
    const node = loadMoreRef.current;
    if (typeof IntersectionObserver === "undefined") return;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && productsQuery.hasNextPage) {
          void productsQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [productsQuery]);

  const products = useMemo(
    () => productsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [productsQuery.data]
  );

  const heroImages = useMemo(
    () => featuredQuery.data?.items.map((item) => item.images[0]).slice(0, 3) ?? [],
    [featuredQuery.data]
  );

  const heroHighlight = featuredQuery.data?.items?.[0];

  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    "Olá! Quero ver os produtos em destaque."
  );

  return (
    <div className="pb-24">
      <section className="relative overflow-hidden pt-28">
        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-gold-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-sage-100/70 blur-3xl" />
        <div className="section-shell grid items-center gap-10 pb-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6 reveal">
            <span className="inline-flex items-center gap-2 rounded-full border border-sand-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-600">
              Coleção 2026
            </span>
            <h1 className="font-serif text-4xl leading-tight text-ink-900 md:text-5xl">
              EncantArtes: velas e presentes com um toque editorial e contemporâneo.
            </h1>
            <p className="text-lg text-ink-600">
              Descubra aromas sutis, texturas naturais e design minimalista para ambientes
              que pedem calmaria e elegância.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="#produtos">Ver produtos</a>
              </Button>
              <Button asChild variant="outline">
                <a href={whatsappLink} target="_blank" rel="noreferrer">
                  Falar no WhatsApp
                </a>
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-600">
              <img src={logo} alt="EncantArtes" className="h-10 w-10 rounded-2xl" />
              <span>Feito à mão com carinho, entregue com cuidado.</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Sparkles, title: "Feito à mão", text: "Peças autorais e exclusivas." },
                { icon: Leaf, title: "Aromas premium", text: "Essências suaves e sofisticadas." },
                { icon: ShieldCheck, title: "Entrega segura", text: "Embalagens que protegem." }
              ].map((item, index) => (
                <div
                  key={item.title}
                  className={`glass-panel flex items-start gap-3 p-4 ${
                    index === 1
                      ? "reveal reveal-delay-1"
                      : index === 2
                        ? "reveal reveal-delay-2"
                        : "reveal"
                  }`}
                >
                  <item.icon className="mt-0.5 h-5 w-5 text-ink-700" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                    <p className="text-xs text-ink-600">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative reveal reveal-delay-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-panel col-span-2 overflow-hidden p-0">
                {heroImages[0] ? (
                  <img
                    src={heroImages[0]}
                    alt="Produto em destaque"
                    className="h-64 w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <Skeleton className="h-64 w-full" />
                )}
              </div>
              <div className="glass-panel overflow-hidden p-0">
                {heroImages[1] ? (
                  <img
                    src={heroImages[1]}
                    alt="Produto EncantArtes"
                    className="h-36 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Skeleton className="h-36 w-full" />
                )}
              </div>
              <div className="glass-panel overflow-hidden p-0">
                {heroImages[2] ? (
                  <img
                    src={heroImages[2]}
                    alt="Produto EncantArtes"
                    className="h-36 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Skeleton className="h-36 w-full" />
                )}
              </div>
            </div>
            <div className="glass-panel absolute -bottom-8 left-6 hidden max-w-[260px] p-4 lg:block animate-floaty">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Destaque</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">
                {heroHighlight?.name ?? "Seleção curada"}
              </p>
              <p className="text-sm text-ink-600">
                {heroHighlight ? formatCurrency(heroHighlight.price) : "A partir de R$ 58"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell -mt-6 pb-16">
        <div className="glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="section-title">Curadoria da semana</h2>
              <p className="text-sm text-ink-600">
                Selecionamos os produtos mais desejados para você presentear com estilo.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-ink-500">Seleção</span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredQuery.isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-40 w-full" />
                ))
              : featuredQuery.data?.items.map((product) => (
                  <div key={product.id} className="rounded-2xl bg-white/80 p-3 shadow-soft">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-28 w-full rounded-xl object-cover"
                      loading="eager"
                      decoding="async"
                    />
                    <p className="mt-2 text-sm font-semibold text-ink-900">{product.name}</p>
                    <p className="text-xs text-ink-600">{product.category}</p>
                  </div>
                ))}
          </div>
        </div>
      </section>

      <section id="produtos" className="section-shell pb-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="section-title">Vitrine EncantArtes</h2>
            <p className="text-sm text-ink-600">
              Explore a coleção completa e escolha suas peças favoritas.
            </p>
          </div>
          <div className="glass-panel flex flex-wrap gap-3 p-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produtos"
                className="pl-9"
                aria-label="Buscar produtos"
              />
            </div>
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Todas categorias</option>
              {categoriesQuery.data?.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(event) => setSort(event.target.value as ProductSort)}>
              <option value="featured">Mais relevantes</option>
              <option value="newest">Novidades</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </Select>
            <Button variant="ghost" className="hidden md:flex">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {productsQuery.isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[340px]" />
              ))
            : products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>

        <div ref={loadMoreRef} className="flex justify-center pt-8">
          {productsQuery.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void productsQuery.fetchNextPage()}
              disabled={productsQuery.isFetchingNextPage}
            >
              {productsQuery.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </Button>
          ) : (
            <p className="text-sm text-ink-500">Você chegou ao fim da vitrine.</p>
          )}
        </div>
      </section>
    </div>
  );
}
