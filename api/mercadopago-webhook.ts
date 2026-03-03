import { json, pickFirstString } from "./_lib/http.js";
import { getAdminEmail, sendCustomerAdminPair } from "./_lib/email.js";
import {
  getPaymentById,
  mapPaymentToOrderStatus,
  refundPaymentById,
  validateWebhookSignature
} from "./_lib/mercadopago.js";
import { adminOrderEmailSubject, buildOrderEmail, customerOrderEmailSubject } from "./_lib/orderEmail.js";
import type { Order } from "../src/types/order";
import { readOrders, withOrdersLock, writeOrders } from "./_lib/store.js";

async function notifyStatusChange(order: Order) {
  const customerEmail = buildOrderEmail(order, "customer");
  const adminEmail = buildOrderEmail(order, "admin");
  const result = await sendCustomerAdminPair({
    customer: {
      to: order.customerEmail,
      subject: customerOrderEmailSubject(order),
      html: customerEmail.html,
      text: customerEmail.text
    },
    admin: {
      to: getAdminEmail(),
      subject: adminOrderEmailSubject(order),
      html: adminEmail.html,
      text: adminEmail.text
    }
  });
  if (!result.customer.ok) {
    console.error(`[email] Cliente nao recebeu atualizacao via webhook do pedido ${order.id}.`);
  }
  if (!result.admin.ok) {
    console.error(`[email] Admin nao recebeu atualizacao via webhook do pedido ${order.id}.`);
  }
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
    const updateResult = await withOrdersLock(async () => {
      const orders = await readOrders();
      const target = orders.find(
        (order) =>
          order.paymentId === String(payment.id) ||
          order.externalReference === payment.external_reference ||
          order.id === payment.external_reference
      );

      if (!target) {
        return { ignored: "order-not-found" } as const;
      }

      const prevStatus = target.status;
      const prevPaymentStatus = target.paymentStatus;
      const prevPaymentId = target.paymentId || "";
      const mapped = mapPaymentToOrderStatus(payment.status);
      const wasCancelled = target.status === "cancelled";
      const isOperationalFlow = target.status === "preparing" || target.status === "shipped";
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
      } else if (isOperationalFlow) {
        const paymentEndedAsFailure = mapped.orderStatus === "cancelled" || mapped.orderStatus === "failed";
        nextOrderStatus = paymentEndedAsFailure ? mapped.orderStatus : target.status;
      }

      const updated = {
        ...target,
        paymentId: String(payment.id),
        paymentStatus: nextPaymentStatus,
        status: nextOrderStatus,
        updatedAt: new Date().toISOString()
      };

      const hasChanged =
        prevStatus !== updated.status ||
        prevPaymentStatus !== updated.paymentStatus ||
        prevPaymentId !== (updated.paymentId || "");
      if (!hasChanged) {
        return { unchanged: true } as const;
      }

      await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
      const notify = prevStatus !== updated.status || prevPaymentStatus !== updated.paymentStatus;
      return { updated, notify } as const;
    }, { ttlSeconds: 45 });

    if ("ignored" in updateResult) {
      return json(res, 200, { ok: true, ignored: updateResult.ignored });
    }
    if ("unchanged" in updateResult) {
      return json(res, 200, { ok: true, unchanged: true });
    }

    if (updateResult.notify) {
      await notifyStatusChange(updateResult.updated);
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}
