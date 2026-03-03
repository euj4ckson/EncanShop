import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Plus, Search, Trash2 } from "lucide-react";
import { AdminProductForm, type AdminProductFormValues } from "@/components/AdminProductForm";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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

export function Admin({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = React.useState<"products" | "fragrances" | "orders" | "settings">(
    "products"
  );
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
    mutationFn: (input: { id: string; status: "preparing" | "shipped" | "cancelled"; reason?: string }) =>
      OrderRepo.updateStatusAsAdmin(input),
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
            loading={ordersQuery.isLoading || updateOrderStatusMutation.isPending}
            onPrepare={(order) =>
              updateOrderStatusMutation.mutate({ id: order.id, status: "preparing" })
            }
            onShip={(order) => updateOrderStatusMutation.mutate({ id: order.id, status: "shipped" })}
            onCancel={(order) => {
              const reason =
                window.prompt("Motivo do cancelamento (opcional):")?.trim().slice(0, 300) || "";
              updateOrderStatusMutation.mutate({
                id: order.id,
                status: "cancelled",
                reason
              });
            }}
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
  onCancel
}: {
  orders: Order[];
  loading: boolean;
  onPrepare: (order: Order) => void;
  onShip: (order: Order) => void;
  onCancel: (order: Order) => void;
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
            const canShip = order.status === "paid" || order.status === "preparing";
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
                  {order.customerName} ({order.customerEmail})
                </p>
                <p className="text-ink-700">Total: R$ {order.total.toFixed(2)}</p>
                <p className="text-ink-600">
                  Status do pedido: <strong>{orderStatusLabel(order.status)}</strong>
                </p>
                <p className="text-ink-600">
                  Pagamento: <strong>{paymentStatusLabel(order.paymentStatus)}</strong>
                </p>

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
      </div>
    </div>
  );
}
