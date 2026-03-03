import type { Order, OrderStatus, PaymentStatus } from "../src/types/order";
import type { Address } from "../src/types/customer";
import { getAdminEmail, sendEmailDetailed, type EmailDeliveryResult } from "./_lib/email.js";
import { json, normalizeEmail, readHeader, readJsonBody } from "./_lib/http.js";
import { adminOrderEmailSubject, buildOrderEmail, customerOrderEmailSubject } from "./_lib/orderEmail.js";

type TestStage = "order_created" | "payment_approved" | "preparing" | "shipped";

type StageResult = {
  stage: TestStage;
  customerSent: boolean;
  adminSent: boolean;
  customerProvider?: string;
  customerError?: string;
  adminProvider?: string;
  adminError?: string;
};

type TestPayload = {
  customerEmail?: string;
  customerName?: string;
};

type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendWithThrottle = (payload: SendEmailPayload) => Promise<EmailDeliveryResult>;

const EMAIL_SEND_MIN_INTERVAL_MS = 650;

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

function isValidEmail(email: string): boolean {
  return email.includes("@") && email.length >= 5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseAddress(): Address {
  return {
    id: "addr_test",
    label: "Endereco de teste",
    cep: "36016380",
    street: "Rua de Teste",
    number: "123",
    neighborhood: "Centro",
    city: "Juiz de Fora",
    state: "MG",
    complement: "",
    reference: "Proximo ao comercio local"
  };
}

function statusByStage(stage: TestStage): { status: OrderStatus; paymentStatus: PaymentStatus } {
  if (stage === "order_created") {
    return { status: "pending_payment", paymentStatus: "created" };
  }
  if (stage === "payment_approved") {
    return { status: "paid", paymentStatus: "approved" };
  }
  if (stage === "preparing") {
    return { status: "preparing", paymentStatus: "approved" };
  }
  return { status: "shipped", paymentStatus: "approved" };
}

function createTestOrder(input: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  stage: TestStage;
  baseTime: Date;
  index: number;
}): Order {
  const { status, paymentStatus } = statusByStage(input.stage);
  const createdAt = new Date(input.baseTime.getTime() + input.index * 60_000).toISOString();
  const updatedAt = new Date(input.baseTime.getTime() + input.index * 90_000).toISOString();

  return {
    id: input.orderId,
    customerId: "cus_test",
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: "32999990000",
    customerCpf: "12345678909",
    items: [
      {
        productId: "prd_test",
        name: "Vela Aromatica de Teste",
        price: 39.9,
        quantity: 1,
        variant: "Branca",
        fragrance: "Baunilha"
      }
    ],
    address: baseAddress(),
    shippingOriginalAmount: 16.9,
    shippingAmount: 16.9,
    subtotal: 39.9,
    total: 56.8,
    paymentMethod: "pix",
    paymentStatus,
    status,
    notes: "Este e um e-mail de validacao disparado pelo painel admin.",
    createdAt,
    updatedAt
  };
}

function createThrottledSender(minIntervalMs: number): SendWithThrottle {
  let lastSentAt = 0;
  return async (payload) => {
    const elapsed = Date.now() - lastSentAt;
    const waitMs = Math.max(0, minIntervalMs - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    const sent = await sendEmailDetailed(payload);
    lastSentAt = Date.now();
    return sent;
  };
}

async function sendStageEmail(input: {
  stage: TestStage;
  order: Order;
  customerEmail: string;
  adminEmail: string;
  sendWithThrottle: SendWithThrottle;
}): Promise<StageResult> {
  const customerEmailPayload = buildOrderEmail(input.order, "customer");
  const adminEmailPayload = buildOrderEmail(input.order, "admin");

  const customerSent = await input.sendWithThrottle({
    to: input.customerEmail,
    subject: customerOrderEmailSubject(input.order),
    html: customerEmailPayload.html,
    text: customerEmailPayload.text
  });
  const adminSent = await input.sendWithThrottle({
    to: input.adminEmail,
    subject: adminOrderEmailSubject(input.order),
    html: adminEmailPayload.html,
    text: adminEmailPayload.text
  });

  return {
    stage: input.stage,
    customerSent: customerSent.ok,
    adminSent: adminSent.ok,
    customerProvider: customerSent.provider,
    customerError: customerSent.error,
    adminProvider: adminSent.provider,
    adminError: adminSent.error
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "Metodo nao permitido." });
    }

    assertAdminAccess(req);

    const body = (await readJsonBody(req)) as TestPayload;
    const adminEmail = getAdminEmail();
    const customerEmail = normalizeEmail(body.customerEmail || adminEmail);
    const customerName = (body.customerName || "Cliente Teste").trim().slice(0, 80);
    if (!isValidEmail(customerEmail)) {
      return json(res, 400, { error: "E-mail de teste invalido." });
    }
    if (!isValidEmail(adminEmail)) {
      return json(res, 500, { error: "ORDER_ADMIN_EMAIL invalido." });
    }

    const baseTime = new Date();
    const baseId = `TESTE-${baseTime.getTime().toString(36).toUpperCase()}`;
    const stages: TestStage[] = ["order_created", "payment_approved", "preparing", "shipped"];
    const results: StageResult[] = [];
    const sendWithThrottle = createThrottledSender(EMAIL_SEND_MIN_INTERVAL_MS);

    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      const order = createTestOrder({
        orderId: `${baseId}-${index + 1}`,
        customerName,
        customerEmail,
        stage,
        baseTime,
        index
      });

      const sent = await sendStageEmail({
        stage,
        order,
        customerEmail,
        adminEmail,
        sendWithThrottle
      });
      results.push(sent);

      if (!sent.customerSent && !sent.adminSent) {
        break;
      }
    }

    const successCount = results.reduce((acc, item) => {
      return acc + (item.customerSent ? 1 : 0) + (item.adminSent ? 1 : 0);
    }, 0);
    const attempts = results.length * 2;
    const ok = successCount === attempts;

    return json(res, 200, {
      ok,
      adminEmail,
      customerEmail,
      results,
      successCount,
      attempts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message === "Nao autorizado." ? 401 : 500;
    return json(res, status, { error: message });
  }
}
