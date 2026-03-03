import type { Address } from "../src/types/customer";
import { getQueryParam, json, normalizeCep, onlyDigits, readJsonBody } from "./_lib/http.js";
import { requireAuthedCustomer } from "./_lib/customerAuth.js";
import { generateId } from "./_lib/security.js";
import { readCustomers, stripCustomerSecret, withCustomersLock, writeCustomers } from "./_lib/store.js";

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

function normalizePhone(value: string): string {
  return onlyDigits(value).slice(0, 13);
}

function validatePhone(phone: string): string | null {
  if (!phone) return null;
  if (phone.length < 10) return "Telefone invalido. Informe DDD + numero.";
  return null;
}

export default async function handler(req: any, res: any) {
  try {
    const authed = await requireAuthedCustomer(req, res);
    if (!authed) return;

    if (req.method === "GET") {
      const customers = await readCustomers();
      const customer = customers.find((item) => item.id === authed.id);
      if (!customer) {
        return json(res, 404, { error: "Cliente nao encontrado." });
      }
      return json(res, 200, stripCustomerSecret(customer));
    }

    if (req.method === "PUT") {
      const body = (await readJsonBody(req)) as { name?: string; phone?: string };
      const hasName = body.name !== undefined;
      const hasPhone = body.phone !== undefined;
      if (!hasName && !hasPhone) {
        return json(res, 400, { error: "Nada para atualizar." });
      }

      const result = await withCustomersLock(async () => {
        const customers = await readCustomers();
        const customerIndex = customers.findIndex((item) => item.id === authed.id);
        if (customerIndex < 0) {
          return { status: 404, body: { error: "Cliente nao encontrado." } } as const;
        }

        const customer = customers[customerIndex];
        const name = hasName ? (body.name || "").trim() : customer.name;
        if (hasName && name.length < 2) {
          return { status: 400, body: { error: "Informe um nome valido." } } as const;
        }

        const phone = hasPhone ? normalizePhone(body.phone || "") : customer.phone || "";
        const phoneError = validatePhone(phone);
        if (phoneError) {
          return { status: 400, body: { error: phoneError } } as const;
        }

        const updated = {
          ...customer,
          name,
          phone: phone || undefined,
          updatedAt: new Date().toISOString()
        };
        customers[customerIndex] = updated;
        await writeCustomers(customers);
        return { status: 200, body: stripCustomerSecret(updated) } as const;
      });

      return json(res, result.status, result.body);
    }

    if (req.method === "POST") {
      const mode = getQueryParam(req.query?.mode);
      if (mode !== "address") {
        return json(res, 400, { error: "Modo invalido." });
      }

      const body = (await readJsonBody(req)) as { address?: Partial<Address> };
      const addressInput = body.address || {};

      const result = await withCustomersLock(async () => {
        const customers = await readCustomers();
        const customerIndex = customers.findIndex((item) => item.id === authed.id);
        if (customerIndex < 0) {
          return { status: 404, body: { error: "Cliente nao encontrado." } } as const;
        }

        const customer = customers[customerIndex];
        const normalized = normalizeAddress(addressInput);
        const error = validateAddress(normalized);
        if (error) {
          return { status: 400, body: { error } } as const;
        }

        const updated = {
          ...customer,
          addresses: [normalized, ...customer.addresses.filter((item) => item.id !== normalized.id)],
          updatedAt: new Date().toISOString()
        };
        customers[customerIndex] = updated;
        await writeCustomers(customers);
        return { status: 201, body: normalized } as const;
      });

      return json(res, result.status, result.body);
    }

    if (req.method === "PATCH") {
      const mode = getQueryParam(req.query?.mode);
      if (mode !== "address") {
        return json(res, 400, { error: "Modo invalido." });
      }
      const addressId = getQueryParam(req.query?.id);
      if (!addressId) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }

      const body = (await readJsonBody(req)) as { address?: Partial<Address> };
      const result = await withCustomersLock(async () => {
        const customers = await readCustomers();
        const customerIndex = customers.findIndex((item) => item.id === authed.id);
        if (customerIndex < 0) {
          return { status: 404, body: { error: "Cliente nao encontrado." } } as const;
        }

        const customer = customers[customerIndex];
        const existing = customer.addresses.find((item) => item.id === addressId);
        if (!existing) {
          return { status: 404, body: { error: "Endereco nao encontrado." } } as const;
        }

        const normalized = normalizeAddress(body.address || {}, existing);
        const error = validateAddress(normalized);
        if (error) {
          return { status: 400, body: { error } } as const;
        }

        const updated = {
          ...customer,
          addresses: customer.addresses.map((item) => (item.id === addressId ? normalized : item)),
          updatedAt: new Date().toISOString()
        };
        customers[customerIndex] = updated;
        await writeCustomers(customers);
        return { status: 200, body: normalized } as const;
      });

      return json(res, result.status, result.body);
    }

    if (req.method === "DELETE") {
      const mode = getQueryParam(req.query?.mode);
      if (mode !== "address") {
        return json(res, 400, { error: "Modo invalido." });
      }
      const addressId = getQueryParam(req.query?.id);
      if (!addressId) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }

      const result = await withCustomersLock(async () => {
        const customers = await readCustomers();
        const customerIndex = customers.findIndex((item) => item.id === authed.id);
        if (customerIndex < 0) {
          return { status: 404, body: { error: "Cliente nao encontrado." } } as const;
        }

        const customer = customers[customerIndex];
        const updated = {
          ...customer,
          addresses: customer.addresses.filter((item) => item.id !== addressId),
          updatedAt: new Date().toISOString()
        };
        customers[customerIndex] = updated;
        await writeCustomers(customers);
        return { status: 204, body: null } as const;
      });

      return json(res, result.status, result.body);
    }

    res.setHeader("Allow", "GET,PUT,POST,PATCH,DELETE");
    return json(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}
