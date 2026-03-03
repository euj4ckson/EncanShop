import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { QuantityControl } from "@/components/QuantityControl";
import { useCart } from "@/store/cart";
import { useCustomer } from "@/store/customer";
import { formatCurrency, onlyDigits } from "@/lib/utils";
import { buildCartMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { useContacts } from "@/services/useContacts";
import { useSeo } from "@/lib/seo";
import { PrefetchLink } from "@/routes/PrefetchLink";
import { ShippingRepo } from "@/services/shippingRepo";
import { OrderRepo } from "@/services/orderRepo";
import type { Address } from "@/types/customer";
import type { CheckoutPaymentMethod, Order, ShippingQuote } from "@/types/order";
import { useToast } from "@/components/ui/Toast";

type AddressDraft = {
  id?: string;
  label?: string;
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
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: ""
};

function toAddressInput(value: AddressDraft): Partial<Address> {
  return {
    id: value.id,
    label: value.label,
    cep: value.cep,
    street: value.street,
    number: value.number,
    complement: value.complement,
    neighborhood: value.neighborhood,
    city: value.city,
    state: value.state,
    reference: value.reference
  };
}

function statusText(order: Order): string {
  if (order.status === "preparing") return "Em preparação";
  if (order.status === "shipped") return "Enviado";
  if (order.status === "paid") return "Pagamento aprovado";
  if (order.status === "failed") return "Pagamento recusado";
  if (order.status === "cancelled") return "Pagamento cancelado";
  return "Aguardando pagamento";
}

function LastOrderCard({
  order,
  whatsappLink
}: {
  order: Order;
  whatsappLink: string;
}) {
  return (
    <div className="rounded-2xl border border-sand-200/70 bg-white/80 p-4">
      <p className="text-xs uppercase tracking-wide text-ink-500">Ultimo pedido</p>
      <p className="text-sm font-semibold text-ink-900">{order.id}</p>
      <p className="text-sm text-ink-700">{statusText(order)}</p>
      {order.notes ? <p className="mt-2 text-xs text-ink-600">Observacoes: {order.notes}</p> : null}
      {order.paymentMethod === "pix" && order.pixQrCodeBase64 ? (
        <div className="mt-3 space-y-2">
          <img
            src={`data:image/png;base64,${order.pixQrCodeBase64}`}
            alt="QR Code PIX"
            className="mx-auto h-40 w-40 rounded-xl border border-sand-200/70 bg-white p-2"
          />
          <Input value={order.pixQrCode || ""} readOnly />
        </div>
      ) : null}
      <div className="mt-3 rounded-xl border border-sand-200/70 bg-sand-50/70 p-3">
        <p className="text-xs text-ink-700">
          Se quiser passar mais detalhes sobre o pedido, fale com a gente no WhatsApp.
        </p>
        <Button asChild variant="outline" className="mt-2 w-full">
          <a href={whatsappLink} target="_blank" rel="noreferrer">
            Enviar detalhes no WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

export function Cart() {
  useSeo({
    title: "Carrinho",
    description: "Finalize seu pedido com PIX, cartão ou WhatsApp."
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { items, subtotal, updateQuantity, removeItem, getItemKey, clear } = useCart();
  const { data: contacts } = useContacts();
  const customer = useCustomer();
  const [address, setAddress] = React.useState<AddressDraft>(emptyAddress);
  const [selectedAddressId, setSelectedAddressId] = React.useState("");
  const [shippingQuote, setShippingQuote] = React.useState<ShippingQuote | null>(null);
  const [isQuoting, setIsQuoting] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<CheckoutPaymentMethod>("whatsapp");
  const [cpf, setCpf] = React.useState("");
  const [orderNotes, setOrderNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lastOrder, setLastOrder] = React.useState<Order | null>(null);

  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    buildCartMessage(items, subtotal)
  );
  const lastOrderWhatsappLink = lastOrder
    ? buildWhatsAppLink(
        contacts?.whatsapp || "553291109045",
        `Ola! Quero passar mais detalhes do pedido ${lastOrder.id}.`
      )
    : "";

  const shippingAmount = shippingQuote?.amount ?? 0;
  const total = subtotal + shippingAmount;

  const applySavedAddress = React.useCallback(
    (saved?: Address) => {
      if (!saved) return;
      setAddress({
        id: saved.id,
        label: saved.label,
        cep: saved.cep,
        street: saved.street,
        number: saved.number,
        complement: saved.complement || "",
        neighborhood: saved.neighborhood,
        city: saved.city,
        state: saved.state,
        reference: saved.reference || ""
      });
    },
    []
  );

  React.useEffect(() => {
    if (!customer.customer?.addresses.length) return;
    if (selectedAddressId) return;
    const first = customer.customer.addresses[0];
    setSelectedAddressId(first.id);
    applySavedAddress(first);
  }, [applySavedAddress, customer.customer?.addresses, selectedAddressId]);

  const quoteShipping = React.useCallback(async () => {
    const cep = onlyDigits(address.cep);
    if (cep.length !== 8 || subtotal <= 0) return;
    setIsQuoting(true);
    try {
      const quote = await ShippingRepo.quote({ cep, subtotal });
      setShippingQuote(quote);
      setAddress((prev) => ({
        ...prev,
        cep: quote.cep,
        street: prev.street || quote.street,
        neighborhood: prev.neighborhood || quote.neighborhood,
        city: prev.city || quote.city,
        state: prev.state || quote.state
      }));
    } catch (error) {
      toast({
        title: "Falha ao calcular frete",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    } finally {
      setIsQuoting(false);
    }
  }, [address.cep, subtotal, toast]);

  React.useEffect(() => {
    const cep = onlyDigits(address.cep);
    if (cep.length !== 8) return;
    const timer = window.setTimeout(() => {
      void quoteShipping();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [address.cep, quoteShipping]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderId = params.get("order_id");
    if (!orderId || !customer.isAuthed) return;
    void (async () => {
      try {
        const order = await OrderRepo.getById(orderId);
        if (order) {
          setLastOrder(order);
        }
      } catch {
        // Ignore background sync failures on return page.
      }
    })();
  }, [customer.isAuthed, location.search]);

  React.useEffect(() => {
    if (!lastOrder || lastOrder.status !== "pending_payment") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const refreshed = await OrderRepo.getById(lastOrder.id);
          if (refreshed) {
            setLastOrder(refreshed);
            if (refreshed.status !== "pending_payment") {
              window.clearInterval(timer);
            }
          }
        } catch {
          // Keep silent polling retries.
        }
      })();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [lastOrder]);

  const handleCreateOrder = async () => {
    if (!customer.isAuthed) {
      toast({
        title: "Faça login para continuar",
        description: "Para pagar com PIX ou cartão, entre na sua conta.",
        variant: "error"
      });
      navigate("/conta");
      return;
    }
    if (!shippingQuote) {
      toast({
        title: "Calcule o frete",
        description: "Informe o CEP e aguarde o cálculo automático.",
        variant: "error"
      });
      return;
    }
    if (paymentMethod === "pix" && onlyDigits(cpf).length !== 11) {
      toast({
        title: "CPF inválido",
        description: "Para PIX, informe um CPF com 11 dígitos.",
        variant: "error"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await OrderRepo.create({
        items,
        address: toAddressInput(address),
        shippingAmount: shippingQuote.amount,
        paymentMethod,
        cpf,
        notes: orderNotes,
        saveAddress: true
      });
      setLastOrder(order);
      if (order.checkoutUrl) {
        window.location.href = order.checkoutUrl;
        return;
      }
      if (order.paymentMethod === "pix") {
        navigate(`/carrinho?order_id=${order.id}`, { replace: true });
        toast({
          title: "PIX gerado",
          description: "Use o QR Code para concluir o pagamento.",
          variant: "success"
        });
        setOrderNotes("");
        clear();
        return;
      }
      toast({
        title: "Pedido criado",
        description: "Acompanhe o status na sua conta.",
        variant: "success"
      });
      setOrderNotes("");
      clear();
    } catch (error) {
      toast({
        title: "Falha ao finalizar pedido",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="section-shell pb-12 pt-28 text-center">
        <div className="glass-panel mx-auto max-w-lg p-8">
          <p className="text-lg text-ink-700">Seu carrinho está vazio.</p>
          <PrefetchLink
            to="/"
            className="mt-4 inline-flex rounded-full border border-sand-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-white"
          >
            Voltar para a vitrine
          </PrefetchLink>
        </div>
        {lastOrder ? (
          <div className="mx-auto mt-4 max-w-lg text-left">
            <LastOrderCard order={lastOrder} whatsappLink={lastOrderWhatsappLink} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="section-shell pb-12 pt-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl text-ink-900">Checkout</h1>
        <PrefetchLink
          to="/?view=products#produtos"
          className="inline-flex rounded-full border border-sand-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-600 transition hover:bg-white"
        >
          Continuar comprando
        </PrefetchLink>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {items.map((item) => {
            const itemKey = getItemKey(item);
            return (
              <div
                key={itemKey}
                className="glass-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-24 w-24 rounded-2xl object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="flex-1">
                  <p className="font-semibold text-ink-900">{item.name}</p>
                  {item.variant ? (
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                      Cor/Variação: {item.variant}
                    </p>
                  ) : null}
                  {item.fragrance ? (
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                      Fragrância: {item.fragrance}
                    </p>
                  ) : null}
                  <p className="text-sm text-ink-600">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <QuantityControl
                    value={item.quantity}
                    onChange={(value) => updateQuantity(itemKey, value)}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => removeItem(itemKey)}
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="glass-panel space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink-900">Entrega</h2>
              {customer.isAuthed && customer.customer?.addresses.length ? (
                <Select
                  value={selectedAddressId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setSelectedAddressId(id);
                    const found = customer.customer?.addresses.find((item) => item.id === id);
                    applySavedAddress(found);
                  }}
                  className="max-w-[220px]"
                >
                  {customer.customer.addresses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label || `${item.street}, ${item.number}`}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="checkout-cep">CEP</Label>
                <Input
                  id="checkout-cep"
                  value={address.cep}
                  onChange={(event) => setAddress((prev) => ({ ...prev, cep: event.target.value }))}
                  placeholder="00000-000"
                />
              </div>
              <div>
                <Label htmlFor="checkout-number">Número</Label>
                <Input
                  id="checkout-number"
                  value={address.number}
                  onChange={(event) => setAddress((prev) => ({ ...prev, number: event.target.value }))}
                  placeholder="123"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="checkout-street">Rua</Label>
                <Input
                  id="checkout-street"
                  value={address.street}
                  onChange={(event) => setAddress((prev) => ({ ...prev, street: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="checkout-neighborhood">Bairro</Label>
                <Input
                  id="checkout-neighborhood"
                  value={address.neighborhood}
                  onChange={(event) =>
                    setAddress((prev) => ({ ...prev, neighborhood: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="checkout-city">Cidade</Label>
                <Input
                  id="checkout-city"
                  value={address.city}
                  onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="checkout-state">UF</Label>
                <Input
                  id="checkout-state"
                  value={address.state}
                  onChange={(event) => setAddress((prev) => ({ ...prev, state: event.target.value }))}
                  maxLength={2}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="checkout-complement">Complemento</Label>
                <Input
                  id="checkout-complement"
                  value={address.complement}
                  onChange={(event) =>
                    setAddress((prev) => ({ ...prev, complement: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="checkout-reference">Referência</Label>
                <Input
                  id="checkout-reference"
                  value={address.reference}
                  onChange={(event) =>
                    setAddress((prev) => ({ ...prev, reference: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="text-sm text-ink-600">
              {isQuoting ? "Calculando frete..." : shippingQuote ? `Frete calculado: ${formatCurrency(shippingQuote.amount)} (${shippingQuote.etaDays} dias úteis)` : "Informe o CEP para calcular o frete automaticamente."}
            </div>
          </div>
        </div>

        <div className="glass-panel h-fit p-6">
          <p className="text-xs uppercase tracking-wide text-ink-500">Subtotal</p>
          <p className="mt-1 text-xl font-semibold text-ink-900">{formatCurrency(subtotal)}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-ink-500">Frete</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{formatCurrency(shippingAmount)}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-ink-500">Total</p>
          <p className="mt-1 text-3xl font-semibold text-ink-900">{formatCurrency(total)}</p>

          <div className="mt-5 space-y-3">
            <Label>Método de pagamento</Label>
            <div className="grid gap-2">
              <Button
                type="button"
                variant={paymentMethod === "whatsapp" ? "primary" : "outline"}
                onClick={() => setPaymentMethod("whatsapp")}
                className="justify-start"
              >
                WhatsApp
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "pix" ? "primary" : "outline"}
                onClick={() => setPaymentMethod("pix")}
                className="justify-start"
              >
                PIX (QR Code)
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "credit_card" ? "primary" : "outline"}
                onClick={() => setPaymentMethod("credit_card")}
                className="justify-start"
              >
                Cartão de crédito (até 4x)
              </Button>
            </div>
          </div>

          {paymentMethod === "pix" ? (
            <div className="mt-4 space-y-2">
              <Label htmlFor="checkout-cpf">CPF do pagador</Label>
              <Input
                id="checkout-cpf"
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <Label htmlFor="checkout-notes">Observacoes do pedido (opcional)</Label>
            <Textarea
              id="checkout-notes"
              rows={3}
              value={orderNotes}
              onChange={(event) => setOrderNotes(event.target.value)}
              placeholder="Ex.: embalar para presente, horario preferencial de entrega..."
            />
          </div>

          {paymentMethod === "whatsapp" ? (
            <Button asChild className="mt-6 w-full">
              <a href={whatsappLink} target="_blank" rel="noreferrer" onClick={() => clear()}>
                Finalizar no WhatsApp
              </a>
            </Button>
          ) : (
            <Button className="mt-6 w-full" onClick={() => void handleCreateOrder()} disabled={isSubmitting}>
              {isSubmitting ? "Processando..." : paymentMethod === "pix" ? "Gerar PIX" : "Ir para pagamento"}
            </Button>
          )}

          {!customer.isAuthed && paymentMethod !== "whatsapp" ? (
            <p className="mt-2 text-xs text-ink-600">
              Pagamentos online exigem login para salvar endereço e acompanhar pedidos.
            </p>
          ) : null}

          <Button variant="outline" className="mt-3 w-full" onClick={clear} type="button">
            Limpar carrinho
          </Button>

          {lastOrder ? (
            <div className="mt-6">
              <LastOrderCard order={lastOrder} whatsappLink={lastOrderWhatsappLink} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

