import type { Fragrance } from "@/types/fragrance";
import { getAdminPassword } from "@/lib/auth";
import { requestJson } from "@/services/http";

function adminHeaders(): HeadersInit {
  return {
    "x-admin-password": getAdminPassword()
  };
}

export const FragranceRepo = {
  async listActive(): Promise<Fragrance[]> {
    return requestJson<Fragrance[]>("/api/fragrances");
  },

  async listAllForAdmin(): Promise<Fragrance[]> {
    return requestJson<Fragrance[]>("/api/fragrances", { headers: adminHeaders() }, { mode: "all" });
  },

  async create(input: { name: string; active?: boolean }): Promise<Fragrance> {
    return requestJson<Fragrance>("/api/fragrances", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(input)
    });
  },

  async update(id: string, input: { name?: string; active?: boolean }): Promise<Fragrance> {
    return requestJson<Fragrance>(
      "/api/fragrances",
      {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(input)
      },
      { id }
    );
  },

  async remove(id: string): Promise<void> {
    await requestJson<void>(
      "/api/fragrances",
      {
        method: "DELETE",
        headers: adminHeaders()
      },
      { id }
    );
  }
};

