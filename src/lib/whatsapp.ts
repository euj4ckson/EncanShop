import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";
import { formatCurrency } from "@/lib/utils";

export function buildWhatsAppLink(phoneDigits: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phoneDigits}?text=${encoded}`;
}

export function buildProductMessage(product: Product): string {
  return `Olá! Quero comprar na EncantArtes: ${product.name} por ${formatCurrency(
    product.price
  )}.`;
}

export function buildCartMessage(items: CartItem[], total: number): string {
  const lines = items.map(
    (item) =>
      `- ${item.name} (Qtd ${item.quantity}) - ${formatCurrency(item.price * item.quantity)}`
  );
  return `Olá! Quero comprar na EncantArtes:\n${lines.join("\n")}\nTotal: ${formatCurrency(
    total
  )}`;
}


