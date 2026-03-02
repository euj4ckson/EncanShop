import type { Address } from "../src/types/customer";
import { getQueryParam, json, normalizeCep, readJsonBody } from "./_lib/http.js";
import { requireAuthedCustomer } from "./_lib/customerAuth.js";
import { generateId } from "./_lib/security.js";
import { readCustomers, stripCustomerSecret, writeCustomers } from "./_lib/store.js";

function validateAddress(address: Partial<Address>): string | null {
  if (normalizeCep(address.cep || "").length !== 8) return "CEP invalido.";
  if (!address.street?.trim()) return "Rua invalida.";
  if (!address.number?.trim()) return "Numero invalido.";
  if (!address.neighborhood?.trim()) return "Bairro invalido.";
  if (!address.city?.trim()) return "Cidade invalida.";
  if (!address.state?.trim()) return "Estado invalido.";
  return null;
}

function normalizeAddress(input: Partial<Address>, existing?: Address): Address {
  return {
    id: existing?.id || generateId("addr"),
    label: input.label?.trim() || existing?.label || "",
    cep: normalizeCep(input.cep || existing?.cep || ""),
    street: (input.street || existing?.street || "").trim(),
    number: (input.number || existing?.number || "").trim(),
    complement: (input.complement || existing?.complement || "").trim(),
    neighborhood: (input.neighborhood || existing?.neighborhood || "").trim(),
    city: (input.city || existing?.city || "").trim(),
    state: (input.state || existing?.state || "").trim().toUpperCase(),
    reference: (input.reference || existing?.reference || "").trim()
  };
}

export default async function handler(req: any, res: any) {
  try {
    const authed = await requireAuthedCustomer(req, res);
    if (!authed) return;

    const customers = await readCustomers();
    const customerIndex = customers.findIndex((item) => item.id === authed.id);
    if (customerIndex < 0) {
      return json(res, 404, { error: "Cliente nao encontrado." });
    }
    const customer = customers[customerIndex];

    if (req.method === "GET") {
      return json(res, 200, stripCustomerSecret(customer));
    }

    if (req.method === "PUT") {
      const body = (await readJsonBody(req)) as { name?: string };
      const name = (body.name || "").trim();
      if (name.length < 2) {
        return json(res, 400, { error: "Informe um nome valido." });
      }

      const updated = {
        ...customer,
        name,
        updatedAt: new Date().toISOString()
      };
      customers[customerIndex] = updated;
      await writeCustomers(customers);
      return json(res, 200, stripCustomerSecret(updated));
    }

    if (req.method === "POST") {
      const mode = getQueryParam(req.query?.mode);
      const body = (await readJsonBody(req)) as { address?: Partial<Address> };
      const addressInput = body.address || {};

      if (mode === "address") {
        const normalized = normalizeAddress(addressInput);
        const error = validateAddress(normalized);
        if (error) {
          return json(res, 400, { error });
        }

        const updated = {
          ...customer,
          addresses: [normalized, ...customer.addresses.filter((item) => item.id !== normalized.id)],
          updatedAt: new Date().toISOString()
        };
        customers[customerIndex] = updated;
        await writeCustomers(customers);
        return json(res, 201, normalized);
      }

      return json(res, 400, { error: "Modo invalido." });
    }

    if (req.method === "PATCH") {
      const mode = getQueryParam(req.query?.mode);
      if (mode !== "address") {
        return json(res, 400, { error: "Modo invalido." });
      }
      const addressId = getQueryParam(req.query?.id);
      if (!addressId) {
        return json(res, 400, { error: "Parâmetro 'id' é obrigatório." });
      }
      const body = (await readJsonBody(req)) as { address?: Partial<Address> };
      const existing = customer.addresses.find((item) => item.id === addressId);
      if (!existing) {
        return json(res, 404, { error: "Endereco nao encontrado." });
      }

      const normalized = normalizeAddress(body.address || {}, existing);
      const error = validateAddress(normalized);
      if (error) {
        return json(res, 400, { error });
      }

      const updated = {
        ...customer,
        addresses: customer.addresses.map((item) => (item.id === addressId ? normalized : item)),
        updatedAt: new Date().toISOString()
      };
      customers[customerIndex] = updated;
      await writeCustomers(customers);
      return json(res, 200, normalized);
    }

    if (req.method === "DELETE") {
      const mode = getQueryParam(req.query?.mode);
      if (mode !== "address") {
        return json(res, 400, { error: "Modo invalido." });
      }
      const addressId = getQueryParam(req.query?.id);
      if (!addressId) {
        return json(res, 400, { error: "Parâmetro 'id' é obrigatório." });
      }

      const updated = {
        ...customer,
        addresses: customer.addresses.filter((item) => item.id !== addressId),
        updatedAt: new Date().toISOString()
      };
      customers[customerIndex] = updated;
      await writeCustomers(customers);
      return json(res, 204, null);
    }

    res.setHeader("Allow", "GET,PUT,POST,PATCH,DELETE");
    return json(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}

