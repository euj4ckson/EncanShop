import type { ShippingQuote } from "../src/types/order";
import { json, normalizeCep, parseNumber, readJsonBody } from "./_lib/http.js";
import { calculateFreight } from "./_lib/shipping.js";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

type BrasilApiResponse = {
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

type AddressLookup = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    clearTimeout(timer);
  }
}

async function lookupCep(cep: string): Promise<AddressLookup | null> {
  const viaCep = await fetchJsonWithTimeout<ViaCepResponse>(`https://viacep.com.br/ws/${cep}/json/`);
  if (viaCep && !viaCep.erro) {
    return {
      cep,
      street: viaCep.logradouro || "",
      neighborhood: viaCep.bairro || "",
      city: viaCep.localidade || "",
      state: viaCep.uf || ""
    };
  }

  const brasilApi = await fetchJsonWithTimeout<BrasilApiResponse>(
    `https://brasilapi.com.br/api/cep/v1/${cep}`
  );
  if (brasilApi) {
    return {
      cep,
      street: brasilApi.street || "",
      neighborhood: brasilApi.neighborhood || "",
      city: brasilApi.city || "",
      state: brasilApi.state || ""
    };
  }

  return null;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "Metodo nao permitido." });
    }

    const body = (await readJsonBody(req)) as { cep?: string; subtotal?: number };
    const cep = normalizeCep(body.cep || "");
    if (cep.length !== 8) {
      return json(res, 400, { error: "CEP invalido." });
    }
    const subtotal = parseNumber(body.subtotal, 0);

    const address = await lookupCep(cep);
    if (!address) {
      return json(res, 502, { error: "Falha ao consultar CEP." });
    }

    const freight = calculateFreight(cep, subtotal);
    const quote: ShippingQuote = {
      amount: freight.amount,
      etaDays: freight.etaDays,
      cep,
      street: address.street,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state
    };

    return json(res, 200, quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}

