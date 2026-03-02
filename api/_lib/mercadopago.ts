import { createHmac, timingSafeEqual } from "node:crypto";
import type { Order, PaymentStatus } from "../../src/types/order";
import { splitFullName } from "./security.js";
import { onlyDigits, pickFirstString } from "./http.js";

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point: string;
};

type MercadoPagoPixResponse = {
  id: number;
  status: PaymentStatus;
  status_detail?: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
};

type MercadoPagoPaymentDetail = {
  id: number;
  status: PaymentStatus;
  status_detail?: string;
  external_reference?: string;
};

type MercadoPagoRefundDetail = {
  id: number;
  payment_id: number;
  amount: number;
  status: string;
};

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN || "";
  if (!token) {
    throw new Error("Configuracao ausente: defina MP_ACCESS_TOKEN.");
  }
  return token;
}

export function getPublicKey(): string {
  return process.env.MP_PUBLIC_KEY || "";
}

function getWebhookBaseUrl(req: any): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const host = pickFirstString(req.headers?.host);
  const protocol = pickFirstString(req.headers?.["x-forwarded-proto"]) || "https";
  return `${protocol}://${host}`;
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T | { message?: string; cause?: unknown }) : null;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message || "Falha no Mercado Pago.";
    throw new Error(message);
  }

  return payload as T;
}

function buildBackUrls(orderId: string, req: any) {
  const base = getWebhookBaseUrl(req);
  return {
    success: `${base}/carrinho?payment_return=success&order_id=${orderId}`,
    pending: `${base}/carrinho?payment_return=pending&order_id=${orderId}`,
    failure: `${base}/carrinho?payment_return=failure&order_id=${orderId}`
  };
}

function getNotificationUrl(req: any): string {
  return `${getWebhookBaseUrl(req)}/api/mercadopago-webhook`;
}

export async function createCardPreference(input: { order: Order; req: any }): Promise<{
  preferenceId: string;
  checkoutUrl: string;
}> {
  const order = input.order;

  const response = await mpFetch<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      external_reference: order.id,
      metadata: {
        order_id: order.id,
        customer_id: order.customerId || ""
      },
      payer: {
        email: order.customerEmail,
        name: order.customerName
      },
      items: [
        ...order.items.map((item) => ({
          id: item.productId,
          title: item.name,
          quantity: item.quantity,
          unit_price: Number(item.price.toFixed(2)),
          currency_id: "BRL",
          description: [
            item.variant ? `Cor: ${item.variant}` : null,
            item.fragrance ? `Fragrancia: ${item.fragrance}` : null
          ]
            .filter(Boolean)
            .join(" | ")
        })),
        {
          id: "shipping",
          title: "Frete",
          quantity: 1,
          unit_price: Number(order.shippingAmount.toFixed(2)),
          currency_id: "BRL"
        }
      ],
      back_urls: buildBackUrls(order.id, input.req),
      auto_return: "approved",
      notification_url: getNotificationUrl(input.req),
      payment_methods: {
        installments: 4,
        excluded_payment_types: [{ id: "ticket" }]
      }
    })
  });

  return {
    preferenceId: response.id,
    checkoutUrl: response.init_point
  };
}

export async function createPixPayment(input: {
  order: Order;
  cpf: string;
  req: any;
}): Promise<{
  paymentId: string;
  paymentStatus: PaymentStatus;
  qrCode: string;
  qrCodeBase64: string;
}> {
  const order = input.order;
  const { firstName, lastName } = splitFullName(order.customerName);
  const cpf = onlyDigits(input.cpf);
  if (cpf.length !== 11) {
    throw new Error("CPF invalido para pagamento PIX.");
  }

  const response = await mpFetch<MercadoPagoPixResponse>("/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      transaction_amount: Number(order.total.toFixed(2)),
      description: `Pedido EncantArtes #${order.id}`,
      payment_method_id: "pix",
      payer: {
        email: order.customerEmail,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: "CPF",
          number: cpf
        }
      },
      external_reference: order.id,
      metadata: {
        order_id: order.id,
        customer_id: order.customerId || ""
      },
      notification_url: getNotificationUrl(input.req)
    })
  });

  return {
    paymentId: String(response.id),
    paymentStatus: response.status,
    qrCode: response.point_of_interaction?.transaction_data?.qr_code || "",
    qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64 || ""
  };
}

export async function getPaymentById(paymentId: string): Promise<MercadoPagoPaymentDetail> {
  return mpFetch<MercadoPagoPaymentDetail>(`/v1/payments/${paymentId}`);
}

export async function cancelPaymentById(paymentId: string): Promise<MercadoPagoPaymentDetail> {
  return mpFetch<MercadoPagoPaymentDetail>(`/v1/payments/${paymentId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" })
  });
}

export async function refundPaymentById(
  paymentId: string,
  amount?: number
): Promise<MercadoPagoRefundDetail> {
  const payload =
    typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? { amount } : {};
  return mpFetch<MercadoPagoRefundDetail>(`/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function mapPaymentToOrderStatus(status: PaymentStatus): {
  paymentStatus: PaymentStatus;
  orderStatus: Order["status"];
} {
  switch (status) {
    case "approved":
      return { paymentStatus: status, orderStatus: "paid" };
    case "cancelled":
      return { paymentStatus: status, orderStatus: "cancelled" };
    case "refunded":
      return { paymentStatus: status, orderStatus: "cancelled" };
    case "rejected":
    case "charged_back":
      return { paymentStatus: status, orderStatus: "failed" };
    case "in_process":
    case "pending":
    case "created":
    default:
      return { paymentStatus: status, orderStatus: "pending_payment" };
  }
}

function safeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function validateWebhookSignature(req: any): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET || "";
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const signatureHeader = pickFirstString(req.headers?.["x-signature"]);
  const requestId = pickFirstString(req.headers?.["x-request-id"]);
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((part) => part.trim())
      .map((part) => {
        const [key, value] = part.split("=");
        return [key, value];
      })
  ) as Record<string, string | undefined>;

  const ts = parts.ts || "";
  const v1 = parts.v1 || "";
  const dataId =
    pickFirstString(req.query?.["data.id"]) ||
    pickFirstString(req.query?.id) ||
    String((req.body as any)?.data?.id || "");

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqualText(expected, v1);
}
