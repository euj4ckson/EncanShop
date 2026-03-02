import * as React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Filter, Leaf, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/ProductCard";
import { useContacts } from "@/services/useContacts";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useSeo } from "@/lib/seo";
import { PAGE_SIZE } from "@/lib/config";
import { ProductsRepo } from "@/services/productsRepo";
import { formatCurrency } from "@/lib/utils";
import type { ProductSort } from "@/services/productRepo";
import { PrefetchLink } from "@/routes/PrefetchLink";
import logo from "@/assets/logo.svg";

export function Home() {
  useSeo({
    title: "Loja",
    description: "EncantArtes: velas artesanais, kits e presentes com charme e aconchego."
  });

  const location = useLocation();
  const showOnlyProducts = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("view") === "products";
  }, [location.search]);

  const { data: contacts } = useContacts();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [sort, setSort] = React.useState<ProductSort>("featured");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const featuredQuery = useQuery({
    queryKey: ["featured"],
    queryFn: () => ProductsRepo.list({ featured: true, pageSize: 4 })
  });

  const weeklyCurationQuery = useQuery({
    queryKey: ["weekly-curation"],
    queryFn: () => ProductsRepo.list({ weeklyCurated: true, pageSize: 4, sort: "featured" })
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => ProductsRepo.listCategories()
  });

  const productsQuery = useInfiniteQuery({
    queryKey: ["products", { search, category, sort }],
    queryFn: ({ pageParam = 0 }) =>
      ProductsRepo.list({
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

  const heroShowcaseItems = useMemo(
    () =>
      (featuredQuery.data?.items ?? [])
        .flatMap((product) =>
          product.images.filter(Boolean).map((image) => ({
            productId: product.id,
            productName: product.name,
            image
          }))
        )
        .slice(0, 3),
    [featuredQuery.data]
  );
  const heroHighlight = featuredQuery.data?.items?.[0];

  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    "Olá! Quero ver os produtos em destaque."
  );

  return (
    <div className="pb-24">
      {!showOnlyProducts ? (
        <>
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
                  Descubra aromas sutis, texturas naturais e design minimalista para ambientes que
                  pedem calmaria e elegância.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <a href="/?view=products#produtos">Ver produtos</a>
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
                    {
                      icon: Leaf,
                      title: "Aromas premium",
                      text: "Essências suaves e sofisticadas."
                    },
                    {
                      icon: ShieldCheck,
                      title: "Entrega segura",
                      text: "Embalagens que protegem."
                    }
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
                  <div className="col-span-2">
                    {heroShowcaseItems[0] ? (
                      <PrefetchLink
                        to={`/produto/${heroShowcaseItems[0].productId}`}
                        className="glass-panel group block overflow-hidden p-0"
                        aria-label={`Ver ${heroShowcaseItems[0].productName}`}
                      >
                        <img
                          src={heroShowcaseItems[0].image}
                          alt={heroShowcaseItems[0].productName}
                          className="h-64 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="eager"
                          decoding="async"
                        />
                      </PrefetchLink>
                    ) : (
                      <Skeleton className="h-64 w-full" />
                    )}
                  </div>
                  <div>
                    {heroShowcaseItems[1] ? (
                      <PrefetchLink
                        to={`/produto/${heroShowcaseItems[1].productId}`}
                        className="glass-panel group block overflow-hidden p-0"
                        aria-label={`Ver ${heroShowcaseItems[1].productName}`}
                      >
                        <img
                          src={heroShowcaseItems[1].image}
                          alt={heroShowcaseItems[1].productName}
                          className="h-36 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                      </PrefetchLink>
                    ) : (
                      <Skeleton className="h-36 w-full" />
                    )}
                  </div>
                  <div>
                    {heroShowcaseItems[2] ? (
                      <PrefetchLink
                        to={`/produto/${heroShowcaseItems[2].productId}`}
                        className="glass-panel group block overflow-hidden p-0"
                        aria-label={`Ver ${heroShowcaseItems[2].productName}`}
                      >
                        <img
                          src={heroShowcaseItems[2].image}
                          alt={heroShowcaseItems[2].productName}
                          className="h-36 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                      </PrefetchLink>
                    ) : (
                      <Skeleton className="h-36 w-full" />
                    )}
                  </div>
                </div>
                {heroHighlight ? (
                  <PrefetchLink
                    to={`/produto/${heroHighlight.id}`}
                    className="glass-panel absolute -bottom-8 left-6 hidden max-w-[260px] animate-floaty p-4 transition hover:-translate-y-0.5 lg:block"
                    aria-label={`Ver destaque ${heroHighlight.name}`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Destaque</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">{heroHighlight.name}</p>
                    <p className="text-sm text-ink-600">{formatCurrency(heroHighlight.price)}</p>
                  </PrefetchLink>
                ) : (
                  <div className="glass-panel absolute -bottom-8 left-6 hidden max-w-[260px] animate-floaty p-4 lg:block">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-500">Destaque</p>
                    <p className="mt-1 text-sm font-semibold text-ink-900">Seleção curada</p>
                    <p className="text-sm text-ink-600">A partir de R$ 58</p>
                  </div>
                )}
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
                {weeklyCurationQuery.isLoading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-40 w-full" />
                    ))
                  : weeklyCurationQuery.data?.items.length
                    ? weeklyCurationQuery.data.items.map((product) => (
                        <PrefetchLink
                          key={product.id}
                          to={`/produto/${product.id}`}
                          className="rounded-2xl bg-white/80 p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
                          aria-label={`Ver ${product.name}`}
                        >
                          {product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="h-28 w-full rounded-xl object-cover"
                              loading="eager"
                              decoding="async"
                            />
                          ) : (
                            <Skeleton className="h-28 w-full rounded-xl" />
                          )}
                          <p className="mt-2 text-sm font-semibold text-ink-900">{product.name}</p>
                          <p className="text-xs text-ink-600">{product.category}</p>
                        </PrefetchLink>
                      ))
                    : (
                        <div className="col-span-full rounded-2xl border border-sand-200/70 bg-white/70 p-4 text-sm text-ink-600">
                          Nenhum produto selecionado para a curadoria da semana ainda. Marque no
                          painel admin.
                        </div>
                      )}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section
        id="produtos"
        className={`section-shell pb-12 ${showOnlyProducts ? "pt-28" : ""}`}
      >
        <div
          className={`flex flex-col gap-4 ${
            showOnlyProducts ? "" : "md:flex-row md:items-end md:justify-between"
          }`}
        >
          <div className={showOnlyProducts ? "max-w-2xl" : ""}>
            <h2 className="section-title">Vitrine EncantArtes</h2>
            <p className="text-sm text-ink-600">
              Explore a coleção completa e escolha suas peças favoritas.
            </p>
          </div>
          <div className={showOnlyProducts ? "glass-panel w-full p-4 md:p-5" : "glass-panel flex flex-wrap gap-3 p-3"}>
            {showOnlyProducts ? (
              <>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
                  <Filter className="h-4 w-4" />
                  Filtros rápidos
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 h-4 w-4 text-ink-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar produtos"
                      className="h-11 rounded-full bg-white/90 pl-10 shadow-soft"
                      aria-label="Buscar produtos"
                    />
                  </div>
                  <Select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-11 rounded-full bg-white/90"
                  >
                    <option value="all">Todas categorias</option>
                    {categoriesQuery.data?.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as ProductSort)}
                    className="h-11 rounded-full bg-white/90"
                  >
                    <option value="featured">Mais relevantes</option>
                    <option value="newest">Novidades</option>
                    <option value="price-asc">Menor preço</option>
                    <option value="price-desc">Maior preço</option>
                  </Select>
                </div>
              </>
            ) : (
              <>
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
                <Select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ProductSort)}
                >
                  <option value="featured">Mais relevantes</option>
                  <option value="newest">Novidades</option>
                  <option value="price-asc">Menor preço</option>
                  <option value="price-desc">Maior preço</option>
                </Select>
                <Button variant="ghost" className="hidden md:flex">
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
              </>
            )}
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
