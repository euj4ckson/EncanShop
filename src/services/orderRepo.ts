import type { Address } from "@/types/customer";
import type { CartItem } from "@/types/cart";
import type { CheckoutPaymentMethod, Order } from "@/types/order";
import { requestJson, customerAuthHeaders } from "@/services/http";

export const OrderRepo = {
  async list(): Promise<Order[]> {
    return requestJson<Order[]>("/api/orders", {
      headers: customerAuthHeaders()
    });
  },

  async getById(id: string): Promise<Order | null> {
    return requestJson<Order | null>(
      "/api/orders",
      {
        headers: customerAuthHeaders()
      },
      { id }
    );
  },

  async create(input: {
    items: CartItem[];
    address: Partial<Address>;
    shippingAmount: number;
    paymentMethod: CheckoutPaymentMethod;
    cpf?: string;
    notes?: string;
    saveAddress?: boolean;
  }): Promise<Order> {
    return requestJson<Order>("/api/orders", {
      method: "POST",
      headers: customerAuthHeaders(),
      body: JSON.stringify(input)
    });
  },

  async cancel(id: string, reason?: string): Promise<Order> {
    return requestJson<Order>(
      "/api/orders",
      {
        method: "PATCH",
        headers: customerAuthHeaders(),
        body: JSON.stringify({ reason })
      },
      { mode: "cancel", id }
    );
  }
};
