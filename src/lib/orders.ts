import type { CheckoutPaymentMethod, Order } from "@/types/order";

export function formatOrderLabel(orderId: string): string {
  const normalized = orderId
    .replace(/^ord_/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  const shortCode = normalized.slice(-8);
  return `Pedido #${shortCode || orderId}`;
}

export function paymentMethodLabel(method: CheckoutPaymentMethod): string {
  if (method === "pix") return "PIX";
  if (method === "credit_card") return "Cartao de credito";
  return "WhatsApp";
}

export function canRetryPayment(order: Order): boolean {
  const pending = order.status === "pending_payment" || order.status === "failed";
  return pending;
}
