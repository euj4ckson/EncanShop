import type { Coupon, CouponType, CouponPreview } from "../src/types/coupon";
import { calculateCouponDiscount, normalizeCouponCode, validateCouponPayload } from "./_lib/coupons.js";
import { getQueryParam, json, parseNumber, readHeader, readJsonBody } from "./_lib/http.js";
import { generateId } from "./_lib/security.js";
import { readCoupons, writeCoupons } from "./_lib/store.js";

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

function parseCouponType(value: unknown): CouponType | null {
  if (value === "fixed" || value === "percent" || value === "free_shipping") return value;
  return null;
}

function normalizeInput(input: { code?: unknown; type?: unknown; value?: unknown; active?: unknown }) {
  const code = normalizeCouponCode(typeof input.code === "string" ? input.code : "");
  const type = parseCouponType(input.type);
  const value = Math.max(0, parseNumber(input.value, 0));
  const active = input.active !== false;
  return { code, type, value, active };
}

export default async function handler(req: any, res: any) {
  try {
    const mode = getQueryParam(req.query?.mode);

    if (req.method === "POST" && mode === "validate") {
      const body = (await readJsonBody(req)) as {
        code?: string;
        subtotal?: number;
        shippingAmount?: number;
      };
      const code = normalizeCouponCode(body.code || "");
      if (!code) {
        return json(res, 400, { error: "Informe um codigo de cupom." });
      }

      const coupons = await readCoupons();
      const coupon = coupons.find((item) => item.code === code && item.active);
      if (!coupon) {
        return json(res, 404, { error: "Cupom invalido ou inativo." });
      }

      const summary = calculateCouponDiscount({
        coupon,
        subtotal: parseNumber(body.subtotal, 0),
        shippingAmount: parseNumber(body.shippingAmount, 0)
      });

      const preview: CouponPreview = {
        code: coupon.code,
        type: coupon.type,
        discountAmount: summary.discountAmount,
        shippingAmount: summary.shippingAmount,
        shippingOriginalAmount: summary.shippingOriginalAmount,
        total: summary.total
      };

      return json(res, 200, preview);
    }

    if (req.method === "GET") {
      const coupons = await readCoupons();
      if (mode === "all") {
        assertAdminAccess(req);
        return json(res, 200, coupons);
      }
      return json(res, 200, coupons.filter((item) => item.active));
    }

    if (req.method === "POST") {
      assertAdminAccess(req);
      const body = (await readJsonBody(req)) as {
        code?: unknown;
        type?: unknown;
        value?: unknown;
        active?: unknown;
      };
      const next = normalizeInput(body);
      if (!next.type) {
        return json(res, 400, { error: "Tipo de cupom invalido." });
      }
      const payloadError = validateCouponPayload({
        code: next.code,
        type: next.type,
        value: next.value
      });
      if (payloadError) {
        return json(res, 400, { error: payloadError });
      }

      const coupons = await readCoupons();
      const exists = coupons.some((item) => item.code === next.code);
      if (exists) {
        return json(res, 409, { error: "Ja existe um cupom com esse codigo." });
      }

      const now = new Date().toISOString();
      const created: Coupon = {
        id: generateId("cup"),
        code: next.code,
        type: next.type,
        value: next.type === "free_shipping" ? 0 : Number(next.value.toFixed(2)),
        active: next.active,
        createdAt: now,
        updatedAt: now
      };
      await writeCoupons([created, ...coupons]);
      return json(res, 201, created);
    }

    if (req.method === "PUT") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }
      const body = (await readJsonBody(req)) as {
        code?: unknown;
        type?: unknown;
        value?: unknown;
        active?: unknown;
      };

      const coupons = await readCoupons();
      const existing = coupons.find((item) => item.id === id);
      if (!existing) {
        return json(res, 404, { error: "Cupom nao encontrado." });
      }

      const normalizedCode =
        body.code !== undefined
          ? normalizeCouponCode(String(body.code || ""))
          : existing.code;
      const normalizedType =
        body.type !== undefined ? parseCouponType(body.type) : existing.type;
      const normalizedValue =
        body.value !== undefined ? Math.max(0, parseNumber(body.value, 0)) : existing.value;
      const normalizedActive = body.active !== undefined ? body.active !== false : existing.active;

      if (!normalizedType) {
        return json(res, 400, { error: "Tipo de cupom invalido." });
      }

      const payloadError = validateCouponPayload({
        code: normalizedCode,
        type: normalizedType,
        value: normalizedValue
      });
      if (payloadError) {
        return json(res, 400, { error: payloadError });
      }

      const duplicate = coupons.some(
        (item) => item.id !== id && item.code === normalizedCode
      );
      if (duplicate) {
        return json(res, 409, { error: "Ja existe um cupom com esse codigo." });
      }

      const updated: Coupon = {
        ...existing,
        code: normalizedCode,
        type: normalizedType,
        value:
          normalizedType === "free_shipping" ? 0 : Number(normalizedValue.toFixed(2)),
        active: normalizedActive,
        updatedAt: new Date().toISOString()
      };

      await writeCoupons(coupons.map((item) => (item.id === id ? updated : item)));
      return json(res, 200, updated);
    }

    if (req.method === "DELETE") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }
      const coupons = await readCoupons();
      await writeCoupons(coupons.filter((item) => item.id !== id));
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
