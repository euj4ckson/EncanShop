import type { Order } from "../../src/types/order";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function statusLabel(status: Order["status"], paymentStatus: Order["paymentStatus"]): string {
  if (status === "preparing") return "Pedido em preparacao";
  if (status === "shipped") return "Pedido enviado";
  if (status === "paid") return "Pagamento aprovado";
  if (status === "cancelled") return "Pagamento cancelado";
  if (status === "failed") return "Pagamento recusado";
  return `Aguardando pagamento (${paymentStatus})`;
}

export function buildOrderEmail(order: Order): { subject: string; html: string; text: string } {
  const itemsHtml = order.items
    .map((item) => {
      const extras = [
        item.variant ? `Cor: ${escapeHtml(item.variant)}` : "",
        item.fragrance ? `Fragrancia: ${escapeHtml(item.fragrance)}` : ""
      ]
        .filter(Boolean)
        .join(" | ");
      return `<li><strong>${escapeHtml(item.name)}</strong> x${item.quantity} - ${formatCurrency(item.price * item.quantity)}${
        extras ? ` <br/><small>${extras}</small>` : ""
      }</li>`;
    })
    .join("");

  const status = statusLabel(order.status, order.paymentStatus);
  const address = escapeHtml(
    `${order.address.street}, ${order.address.number} - ${order.address.neighborhood}, ${order.address.city}/${order.address.state}, CEP ${order.address.cep}`
  );
  const safeCustomerName = escapeHtml(order.customerName);
  const safeCustomerEmail = escapeHtml(order.customerEmail);
  const safeCustomerPhone = order.customerPhone ? escapeHtml(order.customerPhone) : "";
  const safePaymentMethod = escapeHtml(order.paymentMethod);
  const safeNotes = order.notes ? escapeHtml(order.notes) : "";
  const safeCouponCode = order.couponCode ? escapeHtml(order.couponCode) : "";
  const hasDiscount = typeof order.discountAmount === "number" && order.discountAmount > 0;

  return {
    subject: `Pedido ${order.id} - EncantArtes`,
    html: `
      <h2>Pedido ${order.id}</h2>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Cliente:</strong> ${safeCustomerName} (${safeCustomerEmail})</p>
      ${safeCustomerPhone ? `<p><strong>Telefone:</strong> ${safeCustomerPhone}</p>` : ""}
      <p><strong>Endereco:</strong> ${address}</p>
      <p><strong>Pagamento:</strong> ${safePaymentMethod}</p>
      ${safeNotes ? `<p><strong>Observacoes:</strong> ${safeNotes}</p>` : ""}
      <ul>${itemsHtml}</ul>
      <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
      ${hasDiscount ? `<p><strong>Cupom:</strong> ${safeCouponCode} (-${formatCurrency(order.discountAmount || 0)})</p>` : ""}
      <p><strong>Frete:</strong> ${formatCurrency(order.shippingAmount)}</p>
      <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
    `,
    text: [
      `Pedido ${order.id}`,
      `Status: ${status}`,
      `Cliente: ${order.customerName} (${order.customerEmail})`,
      ...(order.customerPhone ? [`Telefone: ${order.customerPhone}`] : []),
      `Endereco: ${address}`,
      `Pagamento: ${order.paymentMethod}`,
      ...(order.notes ? [`Observacoes: ${order.notes}`] : []),
      ...order.items.map((item) => {
        const extras = [item.variant ? `Cor: ${item.variant}` : "", item.fragrance ? `Fragrancia: ${item.fragrance}` : ""]
          .filter(Boolean)
          .join(" | ");
        return `- ${item.name} x${item.quantity} (${formatCurrency(item.price * item.quantity)})${extras ? ` [${extras}]` : ""}`;
      }),
      `Subtotal: ${formatCurrency(order.subtotal)}`,
      ...(hasDiscount ? [`Cupom: ${order.couponCode} (-${formatCurrency(order.discountAmount || 0)})`] : []),
      `Frete: ${formatCurrency(order.shippingAmount)}`,
      `Total: ${formatCurrency(order.total)}`
    ].join("\n")
  };
}
