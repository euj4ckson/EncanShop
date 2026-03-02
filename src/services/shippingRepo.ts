import type { ShippingQuote } from "@/types/order";
import { requestJson } from "@/services/http";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
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

async function quoteLocal(input: { cep: string; subtotal: number }): Promise<ShippingQuote> {
  const cep = normalizeCep(input.cep);
  if (cep.length !== 8) {
    throw new Error("CEP inválido.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) {
    throw new Error("Falha ao consultar CEP.");
  }

  const viaCep = (await response.json()) as ViaCepResponse;
  if (viaCep.erro) {
    throw new Error("CEP não encontrado.");
  }

  const freight = calculateFreight(cep, input.subtotal);
  return {
    amount: freight.amount,
    etaDays: freight.etaDays,
    cep,
    street: viaCep.logradouro || "",
    neighborhood: viaCep.bairro || "",
    city: viaCep.localidade || "",
    state: viaCep.uf || ""
  };
}

export const ShippingRepo = {
  async quote(input: { cep: string; subtotal: number }): Promise<ShippingQuote> {
    try {
      return await requestJson<ShippingQuote>("/api/shipping", {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch (error) {
      // In local Vite dev, /api routes are not available. Fallback keeps checkout usable.
      if (import.meta.env.DEV) {
        return quoteLocal(input);
      }
      throw error;
    }
  }
};

