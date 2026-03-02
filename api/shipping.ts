import type { ShippingQuote } from "../src/types/order";
import { json, normalizeCep, parseNumber, readJsonBody } from "./_lib/http";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

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

    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!viaCepResponse.ok) {
      return json(res, 502, { error: "Falha ao consultar CEP." });
    }
    const viaCep = (await viaCepResponse.json()) as ViaCepResponse;
    if (viaCep.erro) {
      return json(res, 404, { error: "CEP nao encontrado." });
    }

    const freight = calculateFreight(cep, subtotal);
    const quote: ShippingQuote = {
      amount: freight.amount,
      etaDays: freight.etaDays,
      cep,
      street: viaCep.logradouro || "",
      neighborhood: viaCep.bairro || "",
      city: viaCep.localidade || "",
      state: viaCep.uf || ""
    };

    return json(res, 200, quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}

