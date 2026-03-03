import type { Address } from "@/types/customer";
import type { CartItem } from "@/types/cart";
import type { CheckoutPaymentMethod, Order } from "@/types/order";
import { requestJson, customerAuthHeaders } from "@/services/http";
import { getAdminPassword } from "@/lib/auth";

function adminHeaders(): HeadersInit {
  return {
    "x-admin-password": getAdminPassword()
  };
}

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
    couponCode?: string;
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
  },

  async resumePayment(id: string): Promise<Order> {
    return requestJson<Order>(
      "/api/orders",
      {
        method: "POST",
        headers: customerAuthHeaders()
      },
      { mode: "resume_payment", id }
    );
  },

  async listForAdmin(): Promise<Order[]> {
    return requestJson<Order[]>(
      "/api/orders",
      {
        headers: adminHeaders()
      },
      { mode: "admin_all" }
    );
  },

  async updateStatusAsAdmin(input: {
    id: string;
    status: "preparing" | "shipped" | "cancelled";
    reason?: string;
  }): Promise<Order> {
    return requestJson<Order>(
      "/api/orders",
      {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ status: input.status, reason: input.reason })
      },
      { mode: "admin_update", id: input.id }
    );
  },

  async removeAsAdmin(id: string): Promise<void> {
    await requestJson<void>(
      "/api/orders",
      {
        method: "DELETE",
        headers: adminHeaders()
      },
      { mode: "admin_delete", id }
    );
  }
};
