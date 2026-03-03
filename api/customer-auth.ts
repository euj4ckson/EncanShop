import type { Customer } from "../src/types/customer";
import { getQueryParam, json, normalizeEmail, readJsonBody } from "./_lib/http.js";
import { createCustomerToken, generateId, hashPassword, verifyPassword } from "./_lib/security.js";
import { readCustomers, stripCustomerSecret, withCustomersLock, writeCustomers } from "./_lib/store.js";

function validatePassword(password: string): string | null {
  if (password.length < 6) return "A senha deve ter no minimo 6 caracteres.";
  return null;
}

function validateName(name: string): string | null {
  if (name.trim().length < 2) return "Informe um nome valido.";
  return null;
}

function validateEmail(email: string): string | null {
  if (!email.includes("@") || email.length < 5) return "Informe um e-mail valido.";
  return null;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 13);
}

function validatePhone(phone: string): string | null {
  if (!phone) return null;
  if (phone.length < 10) return "Informe um telefone valido com DDD.";
  return null;
}

type AuthResponse = {
  token: string;
  customer: Customer;
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "Metodo nao permitido." });
    }

    const mode = getQueryParam(req.query?.mode);
    const body = (await readJsonBody(req)) as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
    };

    const email = normalizeEmail(body.email || "");
    const password = body.password || "";
    const phone = normalizePhone(body.phone || "");

    const emailError = validateEmail(email);
    if (emailError) {
      return json(res, 400, { error: emailError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return json(res, 400, { error: passwordError });
    }

    const phoneError = validatePhone(phone);
    if (phoneError) {
      return json(res, 400, { error: phoneError });
    }

    if (mode === "register") {
      const name = (body.name || "").trim();
      const nameError = validateName(name);
      if (nameError) {
        return json(res, 400, { error: nameError });
      }
      const result = await withCustomersLock(async () => {
        const customers = await readCustomers();
        const existing = customers.find((item) => item.email === email);
        if (existing) {
          return { error: "Ja existe uma conta com esse e-mail." } as const;
        }

        const now = new Date().toISOString();
        const created = {
          id: generateId("cus"),
          name,
          email,
          phone: phone || undefined,
          passwordHash: hashPassword(password),
          addresses: [],
          createdAt: now,
          updatedAt: now
        };
        await writeCustomers([created, ...customers]);
        const payload: AuthResponse = {
          token: createCustomerToken({ customerId: created.id, email: created.email }),
          customer: stripCustomerSecret(created)
        };
        return { payload } as const;
      });
      if ("error" in result) {
        return json(res, 409, { error: result.error });
      }
      return json(res, 201, result.payload);
    }

    if (mode === "login") {
      const customers = await readCustomers();
      const existing = customers.find((item) => item.email === email);
      if (!existing || !verifyPassword(password, existing.passwordHash)) {
        return json(res, 401, { error: "Credenciais invalidas." });
      }

      const response: AuthResponse = {
        token: createCustomerToken({ customerId: existing.id, email: existing.email }),
        customer: stripCustomerSecret(existing)
      };
      return json(res, 200, response);
    }

    return json(res, 400, { error: "Modo invalido. Use 'register' ou 'login'." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}

