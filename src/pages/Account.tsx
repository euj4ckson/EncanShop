import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/Toast";
import { useSeo } from "@/lib/seo";
import { formatCurrency } from "@/lib/utils";
import { OrderRepo } from "@/services/orderRepo";
import { useCustomer } from "@/store/customer";

type AddressDraft = {
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
};

const emptyAddress: AddressDraft = {
  label: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: ""
};

function statusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Pago";
    case "failed":
      return "Recusado";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendente";
  }
}

export function Account() {
  useSeo({
    title: "Minha conta",
    description: "Acesse seus pedidos e endereços salvos."
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const customer = useCustomer();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [registerName, setRegisterName] = React.useState("");
  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddress);
  const [cancelingOrderId, setCancelingOrderId] = React.useState("");

  const ordersQuery = useQuery({
    queryKey: ["customer-orders", customer.customer?.id],
    queryFn: OrderRepo.list,
    enabled: customer.isAuthed
  });

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await customer.login({ email: loginEmail, password: loginPassword });
      toast({ title: "Login realizado", variant: "success" });
      setLoginPassword("");
    } catch (error) {
      toast({
        title: "Falha no login",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await customer.register({
        name: registerName,
        email: registerEmail,
        password: registerPassword
      });
      toast({ title: "Conta criada", variant: "success" });
      setRegisterPassword("");
    } catch (error) {
      toast({
        title: "Falha ao cadastrar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    }
  };

  const handleSaveAddress = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await customer.saveAddress({
        ...addressDraft,
        state: addressDraft.state.toUpperCase()
      });
      setAddressDraft(emptyAddress);
      toast({ title: "Endereço salvo", variant: "success" });
    } catch (error) {
      toast({
        title: "Falha ao salvar endereço",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    }
  };

  const handleCancelOrder = async (orderId: string, status: string) => {
    const reason =
      window.prompt(
        status === "paid"
          ? "Informe o motivo do cancelamento (o estorno sera solicitado):"
          : "Informe o motivo do cancelamento (opcional):"
      ) || "";
    setCancelingOrderId(orderId);
    try {
      await OrderRepo.cancel(orderId, reason);
      await queryClient.invalidateQueries({ queryKey: ["customer-orders", customer.customer?.id] });
      toast({
        title: status === "paid" ? "Cancelamento e estorno solicitados" : "Pedido cancelado",
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "Falha ao cancelar pedido",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    } finally {
      setCancelingOrderId("");
    }
  };

  if (customer.isLoading) {
    return <div className="section-shell pb-12 pt-28">Carregando conta...</div>;
  }

  if (!customer.isAuthed || !customer.customer) {
    return (
      <div className="section-shell pb-12 pt-28">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h1 className="font-serif text-2xl text-ink-900">Minha conta</h1>
              <p className="text-sm text-ink-600">Entre para acompanhar pedidos e endereços.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant={mode === "login" ? "primary" : "outline"}
                  onClick={() => setMode("login")}
                >
                  Login
                </Button>
                <Button
                  variant={mode === "register" ? "primary" : "outline"}
                  onClick={() => setMode("register")}
                >
                  Cadastro
                </Button>
              </div>
              {mode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-3">
                  <div>
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Entrar
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <Label htmlFor="register-name">Nome</Label>
                    <Input
                      id="register-name"
                      value={registerName}
                      onChange={(event) => setRegisterName(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-email">E-mail</Label>
                    <Input
                      id="register-email"
                      type="email"
                      value={registerEmail}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">Senha</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Criar conta
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-serif text-xl text-ink-900">Vantagens da conta</h2>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-ink-700">
              <p>Salve endereços para reutilizar no checkout.</p>
              <p>Acompanhe status de pedidos em tempo real.</p>
              <p>Receba confirmação por e-mail após cada compra.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell pb-12 pt-28">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-ink-900">Minha conta</h1>
          <p className="text-sm text-ink-600">{customer.customer.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            customer.logout();
            toast({ title: "Sessão encerrada" });
          }}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-xl text-ink-900">Endereços salvos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.customer.addresses.length ? (
              customer.customer.addresses.map((address) => (
                <div key={address.id} className="rounded-2xl border border-sand-200/70 bg-white/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {address.label || "Endereço"}
                      </p>
                      <p className="text-sm text-ink-700">
                        {address.street}, {address.number} - {address.neighborhood}
                      </p>
                      <p className="text-xs text-ink-600">
                        {address.city}/{address.state} - CEP {address.cep}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => void customer.removeAddress(address.id)}
                      aria-label="Remover endereço"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-600">Nenhum endereço salvo ainda.</p>
            )}

            <form onSubmit={handleSaveAddress} className="mt-4 grid gap-3">
              <Input
                placeholder="Apelido (Casa, Trabalho...)"
                value={addressDraft.label}
                onChange={(event) => setAddressDraft((prev) => ({ ...prev, label: event.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="CEP"
                  value={addressDraft.cep}
                  onChange={(event) => setAddressDraft((prev) => ({ ...prev, cep: event.target.value }))}
                  required
                />
                <Input
                  placeholder="Número"
                  value={addressDraft.number}
                  onChange={(event) =>
                    setAddressDraft((prev) => ({ ...prev, number: event.target.value }))
                  }
                  required
                />
              </div>
              <Input
                placeholder="Rua"
                value={addressDraft.street}
                onChange={(event) => setAddressDraft((prev) => ({ ...prev, street: event.target.value }))}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Bairro"
                  value={addressDraft.neighborhood}
                  onChange={(event) =>
                    setAddressDraft((prev) => ({ ...prev, neighborhood: event.target.value }))
                  }
                  required
                />
                <Input
                  placeholder="Cidade"
                  value={addressDraft.city}
                  onChange={(event) => setAddressDraft((prev) => ({ ...prev, city: event.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="UF"
                  value={addressDraft.state}
                  onChange={(event) => setAddressDraft((prev) => ({ ...prev, state: event.target.value }))}
                  required
                />
                <Input
                  placeholder="Complemento"
                  value={addressDraft.complement}
                  onChange={(event) =>
                    setAddressDraft((prev) => ({ ...prev, complement: event.target.value }))
                  }
                />
              </div>
              <Button type="submit">Salvar endereço</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-xl text-ink-900">Meus pedidos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {ordersQuery.isLoading ? (
              <p className="text-sm text-ink-600">Carregando pedidos...</p>
            ) : ordersQuery.data?.length ? (
              ordersQuery.data.map((order) => (
                <div key={order.id} className="rounded-2xl border border-sand-200/70 bg-white/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-900">{order.id}</p>
                    <span className="text-xs uppercase tracking-wide text-ink-600">
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-600">
                    {new Date(order.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-ink-700">
                    {order.items.length} item(ns) - {formatCurrency(order.total)}
                  </p>
                  {order.notes ? (
                    <p className="mt-1 text-xs text-ink-600">Observacoes: {order.notes}</p>
                  ) : null}
                  {order.status === "pending_payment" || order.status === "paid" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => void handleCancelOrder(order.id, order.status)}
                      disabled={cancelingOrderId === order.id}
                    >
                      {cancelingOrderId === order.id
                        ? "Processando..."
                        : order.status === "paid"
                          ? "Cancelar e estornar"
                          : "Cancelar pedido"}
                    </Button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-600">Você ainda não tem pedidos.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
