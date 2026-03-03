import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Search, Trash2 } from "lucide-react";
import { AdminProductForm, type AdminProductFormValues } from "@/components/AdminProductForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { clearSession } from "@/lib/auth";
import { formatPhoneBR, slugify } from "@/lib/utils";
import type { Product } from "@/types/product";
import type { Fragrance } from "@/types/fragrance";
import type { Order } from "@/types/order";
import { PRODUCTS_BACKEND_MODE, ProductsRepo } from "@/services/productsRepo";
import { ContactRepo } from "@/services/contactRepo";
import { useContacts } from "@/services/useContacts";
import { normalizeInstagram, normalizeWhatsapp } from "@/lib/contacts";
import { FragranceRepo } from "@/services/fragranceRepo";
import { OrderRepo } from "@/services/orderRepo";
import { CouponRepo } from "@/services/couponRepo";
import { AdminRepo } from "@/services/adminRepo";
import type { Coupon, CouponType } from "@/types/coupon";

export function Admin({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = React.useState<
    "products" | "fragrances" | "orders" | "coupons" | "settings"
  >("products");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Product | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const showErrorToast = (title: string, error: unknown) => {
    toast({
      title,
      description: error instanceof Error ? error.message : "Tente novamente.",
      variant: "error"
    });
  };

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => ProductsRepo.listAll()
  });
  const fragrancesQuery = useQuery({
    queryKey: ["admin-fragrances"],
    queryFn: () => FragranceRepo.listAllForAdmin()
  });
  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => OrderRepo.listForAdmin()
  });
  const couponsQuery = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => CouponRepo.listForAdmin()
  });

  const createMutation = useMutation({
    mutationFn: (values: AdminProductFormValues) =>
      ProductsRepo.create({
        ...values,
        slug: slugify(values.name)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      await queryClient.invalidateQueries({ queryKey: ["weekly-curation"] });
      toast({ title: "Produto criado", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao criar produto", error)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: AdminProductFormValues }) =>
      ProductsRepo.update(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      await queryClient.invalidateQueries({ queryKey: ["weekly-curation"] });
      toast({ title: "Produto atualizado", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao atualizar produto", error)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ProductsRepo.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      await queryClient.invalidateQueries({ queryKey: ["weekly-curation"] });
      toast({ title: "Produto removido" });
    },
    onError: (error) => showErrorToast("Falha ao remover produto", error)
  });
  const createFragranceMutation = useMutation({
    mutationFn: (name: string) => FragranceRepo.create({ name, active: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-fragrances"] });
      await queryClient.invalidateQueries({ queryKey: ["fragrances"] });
      toast({ title: "Fragrância criada", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao criar fragrância", error)
  });
  const updateFragranceMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<Fragrance> }) =>
      FragranceRepo.update(id, { name: values.name, active: values.active }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-fragrances"] });
      await queryClient.invalidateQueries({ queryKey: ["fragrances"] });
      toast({ title: "Fragrância atualizada", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao atualizar fragrância", error)
  });
  const deleteFragranceMutation = useMutation({
    mutationFn: (id: string) => FragranceRepo.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-fragrances"] });
      await queryClient.invalidateQueries({ queryKey: ["fragrances"] });
      toast({ title: "Fragrância removida" });
    },
    onError: (error) => showErrorToast("Falha ao remover fragrância", error)
  });
  const updateOrderStatusMutation = useMutation({
    mutationFn: (input: {
      id: string;
      status: "preparing" | "shipped" | "cancelled";
      reason?: string;
      note?: string;
      forceUnpaidTransition?: boolean;
    }) => OrderRepo.updateStatusAsAdmin(input),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      const label =
        variables.status === "preparing"
          ? "Pedido em preparação"
          : variables.status === "shipped"
            ? "Pedido enviado"
            : "Pedido cancelado";
      toast({ title: label, variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao atualizar pedido", error)
  });
  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => OrderRepo.removeAsAdmin(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      toast({ title: "Pedido excluido", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao excluir pedido", error)
  });
  const updateOrderTrackingMutation = useMutation({
    mutationFn: (input: {
      id: string;
      trackingCarrier?: string;
      trackingCode?: string;
      trackingUrl?: string;
      note?: string;
    }) => OrderRepo.updateTrackingAsAdmin(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      toast({ title: "Rastreio atualizado", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao atualizar rastreio", error)
  });
  const createCouponMutation = useMutation({
    mutationFn: (input: { code: string; type: CouponType; value: number }) => CouponRepo.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: "Cupom criado", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao criar cupom", error)
  });
  const updateCouponMutation = useMutation({
    mutationFn: (input: { id: string; values: { active?: boolean } }) =>
      CouponRepo.update(input.id, input.values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: "Cupom atualizado", variant: "success" });
    },
    onError: (error) => showErrorToast("Falha ao atualizar cupom", error)
  });
  const deleteCouponMutation = useMutation({
    mutationFn: (id: string) => CouponRepo.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: "Cupom removido" });
    },
    onError: (error) => showErrorToast("Falha ao remover cupom", error)
  });

  const filteredProducts = (productsQuery.data ?? []).filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogout = () => {
    clearSession();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="sticky top-0 z-30 border-b border-sand-200/60 bg-sand-50/80 backdrop-blur-xl">
        <div className="section-shell flex items-center justify-between py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-500">EncantArtes</p>
            <h1 className="font-serif text-2xl text-ink-900">Painel Admin</h1>
            <p className="text-xs text-ink-500">
              Produtos: {PRODUCTS_BACKEND_MODE === "api" ? "Vercel (compartilhado)" : "Local"}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>

      <div className="section-shell grid gap-8 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="glass-panel space-y-3 p-4">
          <Button
            variant={tab === "products" ? "primary" : "ghost"}
            onClick={() => setTab("products")}
            className="w-full justify-start"
          >
            Produtos
          </Button>
          <Button
            variant={tab === "settings" ? "primary" : "ghost"}
            onClick={() => setTab("settings")}
            className="w-full justify-start"
          >
            Configurações
          </Button>
          <Button
            variant={tab === "orders" ? "primary" : "ghost"}
            onClick={() => setTab("orders")}
            className="w-full justify-start"
          >
            Pedidos
          </Button>
          <Button
            variant={tab === "fragrances" ? "primary" : "ghost"}
            onClick={() => setTab("fragrances")}
            className="w-full justify-start"
          >
            Fragrâncias
          </Button>
          <Button
            variant={tab === "coupons" ? "primary" : "ghost"}
            onClick={() => setTab("coupons")}
            className="w-full justify-start"
          >
            Cupons
          </Button>
        </aside>

        {tab === "products" ? (
          <div className="space-y-6">
            <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-500" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar produtos"
                  className="pl-9"
                />
              </div>
              <Button variant="secondary" onClick={() => setSelected(null)} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 rounded-3xl border p-3 transition ${
                      selected?.id === product.id
                        ? "border-gold-300 bg-gold-100/70"
                        : "border-sand-200/70 bg-white/80"
                    }`}
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-14 w-14 rounded-2xl object-cover"
                      loading="lazy"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink-900">{product.name}</p>
                      <p className="text-xs text-ink-500">{product.category}</p>
                    </div>
                    <Button variant="ghost" onClick={() => setSelected(product)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm("Remover este produto?")) {
                          deleteMutation.mutate(product.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <AdminProductForm
                initialValues={
                  selected
                    ? {
                        name: selected.name,
                        price: selected.price,
                        description: selected.description,
                        category: selected.category,
                        images: selected.images,
                        variants: selected.variants ?? [],
                        featured: selected.featured,
                        weeklyCurated: Boolean(selected.weeklyCurated),
                        inStock: selected.inStock
                      }
                    : undefined
                }
                onSubmit={(values) => {
                  if (selected) {
                    updateMutation.mutate({ id: selected.id, values });
                  } else {
                    createMutation.mutate(values);
                  }
                  setSelected(null);
                }}
                onCancel={() => setSelected(null)}
              />
            </div>
          </div>
        ) : tab === "fragrances" ? (
          <AdminFragrances
            fragrances={fragrancesQuery.data ?? []}
            onCreate={(name) => createFragranceMutation.mutate(name)}
            onToggle={(fragrance) =>
              updateFragranceMutation.mutate({
                id: fragrance.id,
                values: { active: !fragrance.active }
              })
            }
            onRemove={(id) => deleteFragranceMutation.mutate(id)}
            loading={
              fragrancesQuery.isLoading ||
              createFragranceMutation.isPending ||
              updateFragranceMutation.isPending ||
              deleteFragranceMutation.isPending
            }
          />
        ) : tab === "orders" ? (
          <AdminOrders
            orders={ordersQuery.data ?? []}
            loading={
              ordersQuery.isLoading ||
              updateOrderStatusMutation.isPending ||
              deleteOrderMutation.isPending ||
              updateOrderTrackingMutation.isPending
            }
            onPrepare={(order) => {
              const isPaid = order.paymentStatus === "approved";
              if (!isPaid) {
                const confirmed = window.confirm(
                  "Este pedido ainda nao foi pago. Deseja realmente colocar como em preparacao mesmo assim?"
                );
                if (!confirmed) return;
              }
              const noteInput = window.prompt(
                "Observacao para o cliente no e-mail de preparacao (opcional):"
              );
              if (noteInput === null) return;
              const note = noteInput.trim().slice(0, 500);
              updateOrderStatusMutation.mutate({
                id: order.id,
                status: "preparing",
                note,
                forceUnpaidTransition: !isPaid
              });
            }}
            onShip={(order) => {
              const isPaid = order.paymentStatus === "approved";
              if (!isPaid) {
                const confirmed = window.confirm(
                  "Este pedido ainda nao foi pago. Deseja realmente marcar como enviado mesmo assim?"
                );
                if (!confirmed) return;
              }
              const noteInput = window.prompt(
                "Observacao para o cliente no e-mail de envio (opcional):"
              );
              if (noteInput === null) return;
              const note = noteInput.trim().slice(0, 500);
              updateOrderStatusMutation.mutate({
                id: order.id,
                status: "shipped",
                note,
                forceUnpaidTransition: !isPaid
              });
            }}
            onCancel={(order) => {
              const reason =
                window.prompt("Motivo do cancelamento (opcional):")?.trim().slice(0, 300) || "";
              updateOrderStatusMutation.mutate({
                id: order.id,
                status: "cancelled",
                reason
              });
            }}
            onDelete={(order) => {
              if (
                window.confirm(
                  `Excluir o pedido ${order.id}? Esta acao nao pode ser desfeita.`
                )
              ) {
                deleteOrderMutation.mutate(order.id);
              }
            }}
            onTracking={(order) => {
              const currentCarrier = order.trackingCarrier || "";
              const currentCode = order.trackingCode || "";
              const currentUrl = order.trackingUrl || "";
              const trackingCarrierInput = window.prompt(
                "Transportadora (ex.: Correios, Jadlog, Total Express). Deixe vazio para remover:",
                currentCarrier
              );
              if (trackingCarrierInput === null) return;
              const trackingCodeInput = window.prompt(
                "Codigo de rastreio (deixe vazio para remover):",
                currentCode
              );
              if (trackingCodeInput === null) return;
              const trackingUrlInput = window.prompt(
                "Link de rastreio (opcional, deixe vazio para remover):",
                currentUrl
              );
              if (trackingUrlInput === null) return;
              const noteInput = window.prompt(
                "Observacao para enviar no e-mail de atualizacao de rastreio (opcional):"
              );
              if (noteInput === null) return;
              updateOrderTrackingMutation.mutate({
                id: order.id,
                trackingCarrier: trackingCarrierInput.trim() || undefined,
                trackingCode: trackingCodeInput.trim() || undefined,
                trackingUrl: trackingUrlInput.trim() || undefined,
                note: noteInput.trim().slice(0, 500) || undefined
              });
            }}
          />
        ) : tab === "coupons" ? (
          <AdminCoupons
            coupons={couponsQuery.data ?? []}
            loading={
              couponsQuery.isLoading ||
              createCouponMutation.isPending ||
              updateCouponMutation.isPending ||
              deleteCouponMutation.isPending
            }
            onCreate={(input) => createCouponMutation.mutate(input)}
            onToggle={(coupon) =>
              updateCouponMutation.mutate({
                id: coupon.id,
                values: { active: !coupon.active }
              })
            }
            onRemove={(id) => deleteCouponMutation.mutate(id)}
          />
        ) : (
          <AdminSettings />
        )}
      </div>
    </div>
  );
}

function AdminFragrances({
  fragrances,
  onCreate,
  onToggle,
  onRemove,
  loading
}: {
  fragrances: Fragrance[];
  onCreate: (name: string) => void;
  onToggle: (fragrance: Fragrance) => void;
  onRemove: (id: string) => void;
  loading: boolean;
}) {
  const [name, setName] = React.useState("");

  return (
    <div className="glass-panel p-6">
      <h2 className="font-serif text-2xl text-ink-900">Fragrâncias globais</h2>
      <p className="text-sm text-ink-600">
        As fragrâncias cadastradas aqui aparecem automaticamente em todos os produtos.
      </p>

      <form
        className="mt-4 flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = name.trim();
          if (!next) return;
          onCreate(next);
          setName("");
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nova fragrância"
          className="max-w-sm"
        />
        <Button type="submit" disabled={loading}>
          Adicionar
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        {fragrances.length ? (
          fragrances.map((fragrance) => (
            <div
              key={fragrance.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200/70 bg-white/80 p-3"
            >
              <div>
                <p className="font-semibold text-ink-900">{fragrance.name}</p>
                <p className="text-xs text-ink-500">{fragrance.active ? "Ativa" : "Inativa"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onToggle(fragrance)} disabled={loading}>
                  {fragrance.active ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="ghost" onClick={() => onRemove(fragrance.id)} disabled={loading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-600">Nenhuma fragrância cadastrada.</p>
        )}
      </div>
    </div>
  );
}

function orderStatusLabel(status: Order["status"]): string {
  switch (status) {
    case "preparing":
      return "Em preparação";
    case "shipped":
      return "Enviado";
    case "paid":
      return "Pago";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendente";
  }
}

function couponTypeLabel(type: CouponType): string {
  switch (type) {
    case "fixed":
      return "Valor fixo";
    case "percent":
      return "Percentual";
    case "free_shipping":
      return "Frete gratis";
    default:
      return type;
  }
}

function couponValueLabel(coupon: Coupon): string {
  if (coupon.type === "percent") return `${coupon.value}%`;
  if (coupon.type === "fixed") return `R$ ${coupon.value.toFixed(2)}`;
  return "Isenta frete";
}

function AdminCoupons({
  coupons,
  loading,
  onCreate,
  onToggle,
  onRemove
}: {
  coupons: Coupon[];
  loading: boolean;
  onCreate: (input: { code: string; type: CouponType; value: number }) => void;
  onToggle: (coupon: Coupon) => void;
  onRemove: (id: string) => void;
}) {
  const [code, setCode] = React.useState("");
  const [type, setType] = React.useState<CouponType>("percent");
  const [value, setValue] = React.useState("10");
  const parsedValue = Number(String(value).replace(",", "."));
  const isInvalidValue =
    type !== "free_shipping" && (!Number.isFinite(parsedValue) || parsedValue <= 0);

  return (
    <div className="glass-panel p-6">
      <h2 className="font-serif text-2xl text-ink-900">Cupons de desconto</h2>
      <p className="text-sm text-ink-600">
        Crie cupons de valor fixo, percentual ou frete gratis para usar no checkout.
      </p>

      <form
        className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_160px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const normalizedCode = code.trim().toUpperCase();
          if (!normalizedCode || isInvalidValue) return;
          onCreate({
            code: normalizedCode,
            type,
            value: type === "free_shipping" ? 0 : parsedValue
          });
          setCode("");
          setType("percent");
          setValue("10");
        }}
      >
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Codigo (ex: BEMVINDO10)"
        />
        <Select value={type} onChange={(event) => setType(event.target.value as CouponType)}>
          <option value="percent">Percentual</option>
          <option value="fixed">Valor fixo</option>
          <option value="free_shipping">Frete gratis</option>
        </Select>
        <Input
          value={type === "free_shipping" ? "0" : value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={type === "percent" ? "Ex: 10" : "Ex: 15.90"}
          disabled={type === "free_shipping"}
        />
        <Button type="submit" disabled={loading || !code.trim() || isInvalidValue}>
          Criar cupom
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        {coupons.length ? (
          coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200/70 bg-white/80 p-3"
            >
              <div>
                <p className="font-semibold text-ink-900">{coupon.code}</p>
                <p className="text-xs text-ink-500">
                  {couponTypeLabel(coupon.type)} - {couponValueLabel(coupon)}
                </p>
                <p className="text-xs text-ink-500">{coupon.active ? "Ativo" : "Inativo"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onToggle(coupon)} disabled={loading}>
                  {coupon.active ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="ghost" onClick={() => onRemove(coupon.id)} disabled={loading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink-600">Nenhum cupom cadastrado.</p>
        )}
      </div>
    </div>
  );
}

function paymentStatusLabel(status: Order["paymentStatus"]): string {
  switch (status) {
    case "approved":
      return "Aprovado";
    case "pending":
    case "in_process":
      return "Pendente";
    case "refunded":
      return "Estornado";
    case "cancelled":
      return "Cancelado";
    case "rejected":
      return "Recusado";
    default:
      return status;
  }
}

function AdminOrders({
  orders,
  loading,
  onPrepare,
  onShip,
  onCancel,
  onDelete,
  onTracking
}: {
  orders: Order[];
  loading: boolean;
  onPrepare: (order: Order) => void;
  onShip: (order: Order) => void;
  onCancel: (order: Order) => void;
  onDelete: (order: Order) => void;
  onTracking: (order: Order) => void;
}) {
  return (
    <div className="glass-panel p-6">
      <h2 className="font-serif text-2xl text-ink-900">Pedidos</h2>
      <p className="text-sm text-ink-600">
        Atualize o status dos pedidos para em preparação, enviado ou cancelado.
      </p>

      <div className="mt-6 space-y-3">
        {orders.length ? (
          orders.map((order) => {
            const canPrepare = order.status !== "cancelled" && order.status !== "shipped";
            const canShip = order.status !== "cancelled" && order.status !== "shipped";
            const canCancel = order.status !== "cancelled";

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-sand-200/70 bg-white/80 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink-900">{order.id}</p>
                  <p className="text-xs uppercase tracking-wide text-ink-500">
                    {new Date(order.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <p className="text-ink-700">
                  {order.customerName} ({order.customerEmail}) -{" "}
                  {order.customerPhone ? formatPhoneBR(order.customerPhone) : "Telefone nao informado"}
                </p>
                <p className="text-ink-700">Total: R$ {order.total.toFixed(2)}</p>
                <p className="text-ink-600">
                  Status do pedido: <strong>{orderStatusLabel(order.status)}</strong>
                </p>
                <p className="text-ink-600">
                  Pagamento: <strong>{paymentStatusLabel(order.paymentStatus)}</strong>
                </p>
                {order.trackingCarrier ? (
                  <p className="text-ink-600">
                    Transportadora: <strong>{order.trackingCarrier}</strong>
                  </p>
                ) : null}
                {order.trackingCode ? (
                  <p className="text-ink-600">
                    Rastreio: <strong>{order.trackingCode}</strong>
                  </p>
                ) : null}
                {order.trackingUrl ? (
                  <p className="text-ink-600">
                    Link:{" "}
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {order.trackingUrl}
                    </a>
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || !canPrepare}
                    onClick={() => onPrepare(order)}
                  >
                    Em preparação
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading || !canShip}
                    onClick={() => onShip(order)}
                  >
                    Enviado
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loading || !canCancel}
                    onClick={() => onCancel(order)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loading}
                    onClick={() => onTracking(order)}
                  >
                    Rastreio
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loading}
                    onClick={() => onDelete(order)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-ink-600">Nenhum pedido encontrado.</p>
        )}
      </div>
    </div>
  );
}

function AdminSettings() {
  const { data } = useContacts();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [whatsapp, setWhatsapp] = React.useState(formatPhoneBR(data?.whatsapp ?? ""));
  const [instagram, setInstagram] = React.useState(data?.instagram ?? "");
  const [testCustomerEmail, setTestCustomerEmail] = React.useState("bersantos2014@gmail.com");
  const [testCustomerName, setTestCustomerName] = React.useState("Cliente Teste");

  React.useEffect(() => {
    setWhatsapp(formatPhoneBR(data?.whatsapp ?? ""));
    setInstagram(data?.instagram ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      ContactRepo.update({
        whatsapp: normalizeWhatsapp(whatsapp),
        instagram: normalizeInstagram(instagram)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contatos atualizados", variant: "success" });
    }
  });

  const testEmailMutation = useMutation({
    mutationFn: (input: { customerEmail?: string; customerName?: string }) =>
      AdminRepo.sendEmailTest(input),
    onSuccess: (response) => {
      const failedCount = response.attempts - response.successCount;
      const variant = response.ok ? "success" : "error";
      const failure = response.results.find((item) => !item.customerSent || !item.adminSent);
      const needsSmtpHint =
        String(failure?.customerError || "").includes("http-403") ||
        String(failure?.customerError || "").includes("resend-sandbox-blocked-external-recipient") ||
        String(failure?.customerError || "").toLowerCase().includes("invalid login") ||
        String(failure?.customerError || "").toLowerCase().includes("authentication");
      const recommendation = needsSmtpHint
        ? " Configure SMTP_USER/SMTP_PASS (ou EMAIL/EMAIL_PASSWORD) com App Password do Gmail e mantenha ORDER_EMAIL_FROM em onboarding@resend.dev apenas para admin/teste."
        : "";
      const failureHint = failure
        ? ` Falha em ${failure.stage}: cliente=${failure.customerError || "ok"} (${failure.customerProvider || "n/a"}) admin=${failure.adminError || "ok"} (${failure.adminProvider || "n/a"}).${recommendation}`
        : "";
      toast({
        title: response.ok ? "Teste de e-mail enviado" : "Teste de e-mail com falhas",
        description: `${response.successCount}/${response.attempts} envios concluidos. Admin: ${response.adminEmail}. Cliente teste: ${response.customerEmail}.${failureHint}`,
        variant
      });
      if (failedCount === 0) return;
    },
    onError: (error) => {
      toast({
        title: "Falha ao enviar teste de e-mail",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    }
  });

  return (
    <div className="glass-panel p-6">
      <h2 className="font-serif text-2xl text-ink-900">Configurações</h2>
      <p className="text-sm text-ink-600">Atualize contatos exibidos no site.</p>
      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            value={whatsapp}
            onChange={(event) => setWhatsapp(formatPhoneBR(event.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            value={instagram}
            onChange={(event) => setInstagram(event.target.value)}
            placeholder="encantartes"
          />
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="mt-2">
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>

        <div className="mt-6 rounded-2xl border border-sand-200/70 bg-white/80 p-4">
          <h3 className="font-serif text-xl text-ink-900">Teste de e-mails</h3>
          <p className="mt-1 text-sm text-ink-600">
            Dispara as 4 notificações de teste (pedido realizado, pagamento confirmado, em preparação e enviado).
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="test-customer-email">E-mail do cliente (opcional)</Label>
              <Input
                id="test-customer-email"
                value={testCustomerEmail}
                onChange={(event) => setTestCustomerEmail(event.target.value)}
                placeholder="cliente@exemplo.com"
              />
              <p className="mt-1 text-xs text-ink-500">
                Se vazio, o teste envia para o mesmo e-mail admin.
              </p>
            </div>
            <div>
              <Label htmlFor="test-customer-name">Nome do cliente (opcional)</Label>
              <Input
                id="test-customer-name"
                value={testCustomerName}
                onChange={(event) => setTestCustomerName(event.target.value)}
                placeholder="Cliente Teste"
              />
            </div>
          </div>

          <Button
            className="mt-4"
            onClick={() =>
              testEmailMutation.mutate({
                customerEmail: testCustomerEmail.trim() || undefined,
                customerName: testCustomerName.trim() || undefined
              })
            }
            disabled={testEmailMutation.isPending}
          >
            {testEmailMutation.isPending ? "Enviando teste..." : "Enviar teste de notificações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
