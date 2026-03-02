import type { Address, AuthPayload, Customer } from "@/types/customer";
import { requestJson, customerAuthHeaders } from "@/services/http";

export const CustomerRepo = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthPayload> {
    return requestJson<AuthPayload>(
      "/api/customer-auth",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      { mode: "register" }
    );
  },

  async login(input: { email: string; password: string }): Promise<AuthPayload> {
    return requestJson<AuthPayload>(
      "/api/customer-auth",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      { mode: "login" }
    );
  },

  async getProfile(): Promise<Customer> {
    return requestJson<Customer>("/api/customer-profile", {
      headers: customerAuthHeaders()
    });
  },

  async updateName(name: string): Promise<Customer> {
    return requestJson<Customer>("/api/customer-profile", {
      method: "PUT",
      headers: customerAuthHeaders(),
      body: JSON.stringify({ name })
    });
  },

  async createAddress(address: Partial<Address>): Promise<Address> {
    return requestJson<Address>(
      "/api/customer-profile",
      {
        method: "POST",
        headers: customerAuthHeaders(),
        body: JSON.stringify({ address })
      },
      { mode: "address" }
    );
  },

  async updateAddress(id: string, address: Partial<Address>): Promise<Address> {
    return requestJson<Address>(
      "/api/customer-profile",
      {
        method: "PATCH",
        headers: customerAuthHeaders(),
        body: JSON.stringify({ address })
      },
      { mode: "address", id }
    );
  },

  async removeAddress(id: string): Promise<void> {
    await requestJson<void>(
      "/api/customer-profile",
      {
        method: "DELETE",
        headers: customerAuthHeaders()
      },
      { mode: "address", id }
    );
  }
};

