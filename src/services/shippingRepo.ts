import type { ShippingQuote } from "@/types/order";
import { requestJson } from "@/services/http";

type ViaCepResponse = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

type BrasilApiResponse = {
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

function normalizeCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

function calculateFreight(cep: string, subtotal: number): { amount: number; etaDays: number } {
  if (subtotal >= 250) {
    return { amount: 0, etaDays: 5 };
  }

  const first = Number(cep.slice(0, 1));
  if (!Number.isFinite(first)) {
    return { amount: 24.9, etaDays: 8 };
  }

  if (first <= 1) return { amount: 14.9, etaDays: 3 };
  if (first <= 3) return { amount: 16.9, etaDays: 4 };
  if (first <= 5) return { amount: 18.9, etaDays: 5 };
  if (first <= 7) return { amount: 22.9, etaDays: 6 };
  return { amount: 26.9, etaDays: 8 };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6500): Promise<T | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function lookupCepClient(cep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null> {
  const viaCep = await fetchJsonWithTimeout<ViaCepResponse>(`https://viacep.com.br/ws/${cep}/json/`);
  if (viaCep && !viaCep.erro) {
    return {
      street: viaCep.logradouro || "",
      neighborhood: viaCep.bairro || "",
      city: viaCep.localidade || "",
      state: viaCep.uf || ""
    };
  }

  const brasilApi = await fetchJsonWithTimeout<BrasilApiResponse>(
    `https://brasilapi.com.br/api/cep/v1/${cep}`
  );
  if (!brasilApi) return null;

  return {
    street: brasilApi.street || "",
    neighborhood: brasilApi.neighborhood || "",
    city: brasilApi.city || "",
    state: brasilApi.state || ""
  };
}

async function quoteLocal(input: { cep: string; subtotal: number }): Promise<ShippingQuote> {
  const cep = normalizeCep(input.cep);
  if (cep.length !== 8) {
    throw new Error("CEP invalido.");
  }

  const address = await lookupCepClient(cep);
  if (!address) {
    throw new Error("Falha ao consultar CEP.");
  }

  const freight = calculateFreight(cep, input.subtotal);
  return {
    amount: freight.amount,
    etaDays: freight.etaDays,
    cep,
    street: address.street,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state
  };
}

export const ShippingRepo = {
  async quote(input: { cep: string; subtotal: number }): Promise<ShippingQuote> {
    try {
      return await requestJson<ShippingQuote>("/api/shipping", {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch (apiError) {
      try {
        return await quoteLocal(input);
      } catch (localError) {
        if (localError instanceof Error) throw localError;
        throw apiError;
      }
    }
  }
};
