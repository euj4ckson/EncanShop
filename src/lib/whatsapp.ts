import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";
import { formatCurrency } from "@/lib/utils";

export function buildWhatsAppLink(phoneDigits: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phoneDigits}?text=${encoded}`;
}

export function buildProductMessage(
  product: Product,
  options?: { variant?: string }
): string {
  const variantLine = options?.variant ? `\nCor/Variação: ${options.variant}` : "";
  return `Olá! Quero comprar na EncantArtes: ${product.name} por ${formatCurrency(product.price)}.${variantLine}`;
}

export function buildCartMessage(items: CartItem[], total: number): string {
  const lines = items.map((item, index) => {
    const subtotal = formatCurrency(item.price * item.quantity);
    const variantLine = item.variant ? `\n   Cor/Variação: ${item.variant}` : "";
    return `${index + 1}. *${item.name}*${variantLine}\n   Quantidade: ${item.quantity}\n   Subtotal: ${subtotal}`;
  });

  return [
    "Olá! Quero finalizar minha compra na EncantArtes.",
    "",
    "*Resumo do pedido*",
    ...lines,
    "",
    `*Total:* ${formatCurrency(total)}`,
    "",
    "Pode me confirmar disponibilidade e prazo de entrega?"
  ].join("\n");
}
