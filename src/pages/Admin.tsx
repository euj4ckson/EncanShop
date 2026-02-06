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
import { ProductRepoLocal } from "@/services/productRepoLocal";
import { ContactRepo } from "@/services/contactRepo";
import { useContacts } from "@/services/useContacts";
import { normalizeInstagram, normalizeWhatsapp } from "@/lib/contacts";

export function Admin({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = React.useState<"products" | "settings">("products");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Product | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => ProductRepoLocal.listAll()
  });

  const createMutation = useMutation({
    mutationFn: (values: AdminProductFormValues) =>
      ProductRepoLocal.create({
        ...values,
        slug: slugify(values.name)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      toast({ title: "Produto criado", variant: "success" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: AdminProductFormValues }) =>
      ProductRepoLocal.update(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      toast({ title: "Produto atualizado", variant: "success" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ProductRepoLocal.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      toast({ title: "Produto removido" });
    }
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
                        featured: selected.featured,
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
        ) : (
          <AdminSettings />
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
