import { getCustomerToken } from "@/lib/customerAuth";

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

export async function requestJson<T>(
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
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text) as T | ApiErrorResponse;
        } catch {
          return { error: text.slice(0, 200) } satisfies ApiErrorResponse;
        }
      })()
    : (undefined as T | ApiErrorResponse);

  if (!response.ok) {
    const message =
      typeof (payload as ApiErrorResponse | undefined)?.error === "string"
        ? (payload as ApiErrorResponse).error
        : "Erro ao comunicar com o servidor.";
    throw new Error(message);
  }

  return payload as T;
}

export function customerAuthHeaders(): HeadersInit {
  const token = getCustomerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

