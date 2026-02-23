import { getAdminPassword } from "@/lib/auth";
import type { Product, ProductInput } from "@/types/product";
import type { ProductListParams, ProductListResult, ProductRepo } from "@/services/productRepo";

type ApiErrorResponse = {
  error?: string;
};

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path, query), {
    ...init,
    headers
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? ((() => {
    try {
      return JSON.parse(text) as T | ApiErrorResponse;
    } catch {
      return { error: text.slice(0, 160) } satisfies ApiErrorResponse;
    }
  })()) : (undefined as T | ApiErrorResponse);

  if (!response.ok) {
    const message =
      typeof (payload as ApiErrorResponse | undefined)?.error === "string"
        ? (payload as ApiErrorResponse).error
        : "Erro ao comunicar com o servidor.";
    throw new Error(message);
  }

  return payload as T;
}

function adminHeaders(): HeadersInit {
  return {
    "x-admin-password": getAdminPassword()
  };
}

export const ProductRepoApi: ProductRepo = {
  async list(params: ProductListParams = {}): Promise<ProductListResult> {
    return requestJson<ProductListResult>("/api/products", undefined, params);
  },

  async listAll(): Promise<Product[]> {
    return requestJson<Product[]>("/api/products", undefined, { mode: "all" });
  },

  async listCategories(): Promise<string[]> {
    return requestJson<string[]>("/api/products", undefined, { mode: "categories" });
  },

  async getById(id: string): Promise<Product | null> {
    return requestJson<Product | null>("/api/products", undefined, { mode: "item", id });
  },

  async getBySlug(slug: string): Promise<Product | null> {
    return requestJson<Product | null>("/api/products", undefined, { mode: "item", slug });
  },

  async create(input: ProductInput): Promise<Product> {
    return requestJson<Product>("/api/products", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(input)
    });
  },

  async update(id: string, input: ProductInput): Promise<Product> {
    return requestJson<Product>(
      "/api/products",
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
      "/api/products",
      {
        method: "DELETE",
        headers: adminHeaders()
      },
      { id }
    );
  }
};
