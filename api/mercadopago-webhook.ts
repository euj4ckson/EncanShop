import { json, pickFirstString } from "./_lib/http.js";
import { getAdminEmail, sendEmail } from "./_lib/email.js";
import {
  getPaymentById,
  mapPaymentToOrderStatus,
  refundPaymentById,
  validateWebhookSignature
} from "./_lib/mercadopago.js";
import { buildOrderEmail } from "./_lib/orderEmail.js";
import { readOrders, writeOrders } from "./_lib/store.js";

async function notifyStatusChange(orderId: string) {
  const orders = await readOrders();
  const order = orders.find((item) => item.id === orderId);
  if (!order) return;

  const email = buildOrderEmail(order);
  await Promise.allSettled([
    sendEmail({
      to: order.customerEmail,
      subject: `Atualizacao do pedido ${order.id}`,
      html: email.html,
      text: email.text
    }),
    sendEmail({
      to: getAdminEmail(),
      subject: `Atualizacao de pagamento ${order.id}`,
      html: email.html,
      text: email.text
    })
  ]);
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      res.setHeader("Allow", "GET,POST");
      return json(res, 405, { error: "Metodo nao permitido." });
    }

    if (!validateWebhookSignature(req)) {
      return json(res, 401, { error: "Assinatura invalida." });
    }

    const topic = pickFirstString(req.query?.type) || pickFirstString(req.query?.topic);
    const dataId =
      pickFirstString(req.query?.["data.id"]) ||
      pickFirstString(req.query?.id) ||
      String((req.body as any)?.data?.id || "");

    if (topic !== "payment" || !dataId) {
      return json(res, 200, { ok: true, ignored: true });
    }

    const payment = await getPaymentById(dataId);
    const orders = await readOrders();

    const target = orders.find(
      (order) =>
        order.paymentId === String(payment.id) ||
        order.externalReference === payment.external_reference ||
        order.id === payment.external_reference
    );

    if (!target) {
      return json(res, 200, { ok: true, ignored: "order-not-found" });
    }

    const prevStatus = target.status;
    const mapped = mapPaymentToOrderStatus(payment.status);
    const wasCancelled = target.status === "cancelled";
    let nextPaymentStatus = mapped.paymentStatus;
    let nextOrderStatus = mapped.orderStatus;

    if (wasCancelled && payment.status === "approved") {
      await refundPaymentById(String(payment.id), target.total);
      nextPaymentStatus = "refunded";
      nextOrderStatus = "cancelled";
    } else if (wasCancelled) {
      nextOrderStatus = "cancelled";
      if (payment.status === "refunded") {
        nextPaymentStatus = "refunded";
      }
    }

    const updated = {
      ...target,
      paymentId: String(payment.id),
      paymentStatus: nextPaymentStatus,
      status: nextOrderStatus,
      updatedAt: new Date().toISOString()
    };

    await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));

    if (prevStatus !== updated.status) {
      await notifyStatusChange(updated.id);
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}
