import type { Fragrance } from "../src/types/fragrance";
import { getQueryParam, json, readHeader, readJsonBody } from "./_lib/http.js";
import { generateId } from "./_lib/security.js";
import { readFragrances, writeFragrances } from "./_lib/store.js";

function getAdminPasswordFromEnv(): string {
  const password = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || "";
  if (password) return password;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Configuracao ausente: defina ADMIN_PASSWORD.");
  }
  return "encantartes123";
}

function assertAdminAccess(req: any): void {
  const headerPassword = readHeader(req.headers?.["x-admin-password"]);
  if (!headerPassword || headerPassword !== getAdminPasswordFromEnv()) {
    throw new Error("Nao autorizado.");
  }
}

function normalizeName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const mode = getQueryParam(req.query?.mode);
      const fragrances = await readFragrances();
      if (mode === "all") {
        assertAdminAccess(req);
        return json(res, 200, fragrances);
      }
      return json(res, 200, fragrances.filter((item) => item.active));
    }

    if (req.method === "POST") {
      assertAdminAccess(req);
      const body = (await readJsonBody(req)) as { name?: string; active?: boolean };
      const name = normalizeName(body?.name);
      if (name.length < 2) {
        return json(res, 400, { error: "Informe um nome valido para a fragrancia." });
      }

      const fragrances = await readFragrances();
      const exists = fragrances.some((item) => item.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        return json(res, 409, { error: "Essa fragrancia ja existe." });
      }

      const now = new Date().toISOString();
      const created: Fragrance = {
        id: generateId("frag"),
        name,
        active: body?.active ?? true,
        createdAt: now,
        updatedAt: now
      };
      await writeFragrances([created, ...fragrances]);
      return json(res, 201, created);
    }

    if (req.method === "PUT") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parâmetro 'id' é obrigatório." });
      }
      const body = (await readJsonBody(req)) as { name?: string; active?: boolean };
      const fragrances = await readFragrances();
      const existing = fragrances.find((item) => item.id === id);
      if (!existing) {
        return json(res, 404, { error: "Fragrancia nao encontrada." });
      }

      const nextName = body.name !== undefined ? normalizeName(body.name) : existing.name;
      if (nextName.length < 2) {
        return json(res, 400, { error: "Informe um nome valido para a fragrancia." });
      }

      const duplicate = fragrances.some(
        (item) => item.id !== id && item.name.toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) {
        return json(res, 409, { error: "Essa fragrancia ja existe." });
      }

      const updated: Fragrance = {
        ...existing,
        name: nextName,
        active: body.active ?? existing.active,
        updatedAt: new Date().toISOString()
      };
      await writeFragrances(fragrances.map((item) => (item.id === id ? updated : item)));
      return json(res, 200, updated);
    }

    if (req.method === "DELETE") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parâmetro 'id' é obrigatório." });
      }
      const fragrances = await readFragrances();
      await writeFragrances(fragrances.filter((item) => item.id !== id));
      return json(res, 204, null);
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    return json(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message === "Nao autorizado." ? 401 : 500;
    return json(res, status, { error: message });
  }
}
