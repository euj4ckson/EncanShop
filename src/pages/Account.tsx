import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  LogOut,
  MessageCircle,
  QrCode,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/Toast";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { canRetryPayment, formatOrderLabel, paymentMethodLabel } from "@/lib/orders";
import { useSeo } from "@/lib/seo";
import { formatCurrency, formatPhoneBR, onlyDigits } from "@/lib/utils";
import { OrderRepo } from "@/services/orderRepo";
import { useContacts } from "@/services/useContacts";
import { useCustomer } from "@/store/customer";
import type { Order } from "@/types/order";

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
    case "preparing":
      return "Em preparacao";
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

function paymentStatusLabel(status: string): string {
  switch (status) {
    case "approved":
      return "Aprovado";
    case "pending":
    case "in_process":
    case "created":
      return "Pendente";
    case "rejected":
      return "Recusado";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Estornado";
    default:
      return status;
  }
}

export function Account() {
  useSeo({
    title: "Minha conta",
    description: "Acesse seus pedidos e enderecos salvos."
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const customer = useCustomer();
  const { data: contacts } = useContacts();
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [registerName, setRegisterName] = React.useState("");
  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [registerPhone, setRegisterPhone] = React.useState("");
  const [profilePhone, setProfilePhone] = React.useState("");
  const [isSavingPhone, setIsSavingPhone] = React.useState(false);
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddress);
  const [cancelingOrderId, setCancelingOrderId] = React.useState("");
  const [resumingOrderId, setResumingOrderId] = React.useState("");
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);

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
        password: registerPassword,
        phone: registerPhone
      });
      toast({ title: "Conta criada", variant: "success" });
      setRegisterPassword("");
      setRegisterPhone("");
    } catch (error) {
      toast({
        title: "Falha ao cadastrar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    }
  };

  React.useEffect(() => {
    setProfilePhone(formatPhoneBR(customer.customer?.phone || ""));
  }, [customer.customer?.phone]);

  const handleSavePhone = async () => {
    setIsSavingPhone(true);
    try {
      await customer.updatePhone(profilePhone);
      toast({ title: "Telefone atualizado", variant: "success" });
    } catch (error) {
      toast({
        title: "Falha ao salvar telefone",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    } finally {
      setIsSavingPhone(false);
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
      toast({ title: "Endereco salvo", variant: "success" });
    } catch (error) {
      toast({
        title: "Falha ao salvar endereco",
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
      const updated = await OrderRepo.cancel(orderId, reason);
      queryClient.setQueryData<Order[]>(
        ["customer-orders", customer.customer?.id],
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? [updated]
      );
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

  const handleResumePayment = async (order: Order) => {
    if (!canRetryPayment(order) || order.paymentMethod === "whatsapp") return;
    setResumingOrderId(order.id);
    try {
      const updated = await OrderRepo.resumePayment(order.id);
      queryClient.setQueryData<Order[]>(
        ["customer-orders", customer.customer?.id],
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? [updated]
      );

      if (updated.paymentMethod === "credit_card" && updated.checkoutUrl) {
        window.location.href = updated.checkoutUrl;
        return;
      }

      toast({
        title: "Pagamento pronto",
        description:
          updated.paymentMethod === "pix"
            ? "QR Code PIX atualizado para este pedido."
            : "Siga para concluir o pagamento.",
        variant: "success"
      });
    } catch (error) {
      toast({
        title: "Falha ao retomar pagamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    } finally {
      setResumingOrderId("");
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
              <p className="text-sm text-ink-600">Entre para acompanhar pedidos e enderecos.</p>
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
                  <div>
                    <Label htmlFor="register-phone">Telefone (opcional)</Label>
                    <Input
                      id="register-phone"
                      value={registerPhone}
                      onChange={(event) => setRegisterPhone(formatPhoneBR(event.target.value))}
                      placeholder="+55 32 99999-0000"
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
              <p>Salve enderecos para reutilizar no checkout.</p>
              <p>Acompanhe status dos pedidos em tempo real.</p>
              <p>Receba confirmacao por e-mail apos cada compra.</p>
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
          <p className="text-sm text-ink-600">
            {customer.customer.phone ? formatPhoneBR(customer.customer.phone) : "Telefone nao informado"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            customer.logout();
            toast({ title: "Sessao encerrada" });
          }}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-xl text-ink-900">Enderecos salvos</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-sand-200/70 bg-sand-50/60 p-3">
              <p className="text-sm font-semibold text-ink-900">Telefone de contato</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(formatPhoneBR(event.target.value))}
                  placeholder="+55 32 99999-0000"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSavePhone()}
                  disabled={isSavingPhone || (profilePhone && onlyDigits(profilePhone).length < 10)}
                >
                  {isSavingPhone ? "Salvando..." : "Salvar telefone"}
                </Button>
              </div>
            </div>

            {customer.customer.addresses.length ? (
              customer.customer.addresses.map((address) => (
                <div key={address.id} className="rounded-2xl border border-sand-200/70 bg-white/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{address.label || "Endereco"}</p>
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
                      aria-label="Remover endereco"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-600">Nenhum endereco salvo ainda.</p>
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
                  placeholder="Numero"
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
              <Button type="submit">Salvar endereco</Button>
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
              ordersQuery.data.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const isPendingPayment = canRetryPayment(order);
                const whatsappLink = buildWhatsAppLink(
                  contacts?.whatsapp || "553291109045",
                  `Ola! Quero concluir o pagamento do pedido ${order.id}.`
                );

                return (
                  <div key={order.id} className="rounded-2xl border border-sand-200/70 bg-white/70 p-3">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() =>
                        setExpandedOrderId((current) => (current === order.id ? null : order.id))
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">
                            {formatOrderLabel(order.id)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-ink-600">
                            {statusLabel(order.status)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-ink-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-ink-500" />
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-ink-600">
                        {new Date(order.createdAt).toLocaleString("pt-BR")}
                      </p>
                      <p className="text-sm text-ink-700">
                        {order.items.length} item(ns) - {formatCurrency(order.total)}
                      </p>
                    </button>

                    {isExpanded ? (
                      <div className="mt-3 space-y-3 border-t border-sand-200/70 pt-3">
                        <p className="text-xs text-ink-600">
                          Pagamento: {paymentMethodLabel(order.paymentMethod)} (
                          {paymentStatusLabel(order.paymentStatus)})
                        </p>

                        <div className="rounded-xl border border-sand-200/70 bg-sand-50/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">
                            Itens do pedido
                          </p>
                          <div className="mt-2 space-y-1 text-sm text-ink-700">
                            {order.items.map((item, index) => (
                              <p key={`${order.id}-${item.productId}-${index}`}>
                                {item.quantity}x {item.name}
                                {item.variant ? ` - Cor: ${item.variant}` : ""}
                                {item.fragrance ? ` - Fragrancia: ${item.fragrance}` : ""}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-sand-200/70 bg-sand-50/60 p-3 text-xs text-ink-700">
                          <p>
                            Entrega: {order.address.street}, {order.address.number} -{" "}
                            {order.address.neighborhood}, {order.address.city}/{order.address.state} - CEP{" "}
                            {order.address.cep}
                          </p>
                          {order.discountAmount ? (
                            <p className="mt-1">
                              Desconto ({order.couponCode || "cupom"}): -{" "}
                              {formatCurrency(order.discountAmount)}
                            </p>
                          ) : null}
                          <p className="mt-1">Frete: {formatCurrency(order.shippingAmount)}</p>
                          <p className="mt-1 font-semibold">Total: {formatCurrency(order.total)}</p>
                        </div>

                        {order.notes ? (
                          <p className="text-xs text-ink-600">Observacoes: {order.notes}</p>
                        ) : null}

                        {isPendingPayment ? (
                          <div className="space-y-2">
                            {order.paymentMethod === "credit_card" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleResumePayment(order)}
                                disabled={resumingOrderId === order.id}
                              >
                                <CreditCard className="h-4 w-4" />
                                {resumingOrderId === order.id ? "Processando..." : "Pagar com cartao"}
                              </Button>
                            ) : order.paymentMethod === "pix" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleResumePayment(order)}
                                disabled={resumingOrderId === order.id}
                              >
                                <QrCode className="h-4 w-4" />
                                {resumingOrderId === order.id ? "Processando..." : "Pagar com PIX"}
                              </Button>
                            ) : (
                              <Button asChild variant="outline" size="sm">
                                <a href={whatsappLink} target="_blank" rel="noreferrer">
                                  <MessageCircle className="h-4 w-4" />
                                  Finalizar no WhatsApp
                                </a>
                              </Button>
                            )}

                            {order.paymentMethod === "pix" && order.pixQrCodeBase64 ? (
                              <div className="space-y-2 rounded-xl border border-sand-200/70 bg-white/80 p-3">
                                <img
                                  src={`data:image/png;base64,${order.pixQrCodeBase64}`}
                                  alt="QR Code PIX"
                                  className="mx-auto h-40 w-40 rounded-xl border border-sand-200/70 bg-white p-2"
                                />
                                <Input value={order.pixQrCode || ""} readOnly className="text-xs" />
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {order.status === "pending_payment" || order.status === "paid" ? (
                          <Button
                            variant="outline"
                            size="sm"
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
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-ink-600">Voce ainda nao tem pedidos.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
