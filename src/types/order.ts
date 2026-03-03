import type { Address } from "@/types/customer";
import type { CartItem } from "@/types/cart";

export type CheckoutPaymentMethod = "whatsapp" | "pix" | "credit_card";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "failed"
  | "cancelled";

export type PaymentStatus =
  | "created"
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type Order = {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerCpf?: string;
  items: CartItem[];
  address: Address;
  shippingAmount: number;
  subtotal: number;
  total: number;
  paymentMethod: CheckoutPaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  notes?: string;
  paymentId?: string;
  preferenceId?: string;
  externalReference?: string;
  checkoutUrl?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShippingQuote = {
  amount: number;
  etaDays: number;
  city: string;
  state: string;
  street: string;
  neighborhood: string;
  cep: string;
};
