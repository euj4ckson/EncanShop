import type { Address } from "../src/types/customer";
import type { CartItem } from "../src/types/cart";
import type { CheckoutPaymentMethod, Order } from "../src/types/order";
import {
  getQueryParam,
  json,
  normalizeCep,
  onlyDigits,
  parseNumber,
  readHeader,
  readJsonBody
} from "./_lib/http.js";
import { requireAuthedCustomer } from "./_lib/customerAuth.js";
import { getAdminEmail, sendCustomerAdminPair } from "./_lib/email.js";
import {
  cancelPaymentById,
  createCardPreference,
  createPixPayment,
  getPaymentById,
  mapPaymentToOrderStatus,
  refundPaymentById
} from "./_lib/mercadopago.js";
import { calculateCouponDiscount, normalizeCouponCode } from "./_lib/coupons.js";
import { adminOrderEmailSubject, buildOrderEmail, customerOrderEmailSubject } from "./_lib/orderEmail.js";
import { generateId } from "./_lib/security.js";
import { readCoupons, readCustomers, readOrders, writeCustomers, writeOrders } from "./_lib/store.js";

type AdminOrderStatus = Extract<Order["status"], "preparing" | "shipped" | "cancelled">;

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

function normalizeAddress(value: Partial<Address>): Address {
  return {
    id: value.id || generateId("addr"),
    label: value.label?.trim() || "",
    cep: normalizeCep(value.cep || ""),
    street: (value.street || "").trim(),
    number: (value.number || "").trim(),
    complement: (value.complement || "").trim(),
    neighborhood: (value.neighborhood || "").trim(),
    city: (value.city || "").trim(),
    state: (value.state || "").trim().toUpperCase(),
    reference: (value.reference || "").trim()
  };
}

function validateAddress(address: Address): string | null {
  if (address.cep.length !== 8) return "CEP invalido.";
  if (!address.street) return "Rua invalida.";
  if (!address.number) return "Numero invalido.";
  if (!address.neighborhood) return "Bairro invalido.";
  if (!address.city) return "Cidade invalida.";
  if (!address.state) return "Estado invalido.";
  return null;
}

function normalizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = (item || {}) as Partial<CartItem>;
      return {
        productId: String(raw.productId || ""),
        name: String(raw.name || ""),
        price: parseNumber(raw.price, 0),
        quantity: Math.max(1, parseNumber(raw.quantity, 1)),
        image: raw.image ? String(raw.image) : undefined,
        variant: raw.variant ? String(raw.variant) : undefined,
        fragrance: raw.fragrance ? String(raw.fragrance) : undefined
      } satisfies CartItem;
    })
    .filter((item) => item.productId && item.name && item.price > 0);
}

function computeSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function areAddressesEqual(a: Address, b: Address): boolean {
  return (
    a.cep === b.cep &&
    a.street.toLowerCase() === b.street.toLowerCase() &&
    a.number.toLowerCase() === b.number.toLowerCase() &&
    a.city.toLowerCase() === b.city.toLowerCase() &&
    a.state.toLowerCase() === b.state.toLowerCase()
  );
}

function canCustomerCancelOrder(order: Order): boolean {
  return order.status === "pending_payment" || order.status === "paid";
}

function canCustomerRetryPayment(order: Order): boolean {
  return order.status === "pending_payment" || order.status === "failed";
}

function appendNote(current: string | undefined, line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed) return current;
  return [current, trimmed].filter(Boolean).join("\n");
}

function parseAdminStatus(value: unknown): AdminOrderStatus | null {
  if (value === "preparing" || value === "shipped" || value === "cancelled") return value;
  return null;
}

function normalizeTrackingCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 60);
  return normalized || undefined;
}

function normalizeTrackingUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const url = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
    return parsed.toString().slice(0, 500);
  } catch {
    return undefined;
  }
}

function withCustomerPhoneFallback(orders: Order[], customers: Array<{ id: string; phone?: string }>): Order[] {
  if (!orders.length || !customers.length) return orders;
  const phoneByCustomerId = new Map<string, string>();
  for (const customer of customers) {
    const phone = onlyDigits(customer.phone || "");
    if (customer.id && phone) {
      phoneByCustomerId.set(customer.id, phone);
    }
  }
  return orders.map((order) => {
    if (order.customerPhone || !order.customerId) return order;
    const phone = phoneByCustomerId.get(order.customerId);
    if (!phone) return order;
    return { ...order, customerPhone: phone };
  });
}

async function sendOrderNotifications(order: Order): Promise<void> {
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
    console.error(`[email] Cliente nao recebeu notificacao de pedido ${order.id}.`);
  }
  if (!result.admin.ok) {
    console.error(`[email] Admin nao recebeu notificacao de pedido ${order.id}.`);
  }
}

async function sendOrderStatusNotifications(order: Order): Promise<void> {
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
    console.error(`[email] Cliente nao recebeu atualizacao de status do pedido ${order.id}.`);
  }
  if (!result.admin.ok) {
    console.error(`[email] Admin nao recebeu atualizacao de status do pedido ${order.id}.`);
  }
}

async function cancelOrderWithPayment(
  target: Order,
  reason: string,
  actor: "cliente" | "admin"
): Promise<Order> {
  const noteLine = reason ? `Cancelamento (${actor}): ${reason}` : "";
  const updated: Order = {
    ...target,
    status: "cancelled",
    notes: appendNote(target.notes, noteLine),
    updatedAt: new Date().toISOString()
  };

  if (target.paymentId) {
    if (target.paymentStatus === "approved") {
      await refundPaymentById(target.paymentId, target.total);
      updated.paymentStatus = "refunded";
    } else if (
      target.paymentStatus === "pending" ||
      target.paymentStatus === "in_process" ||
      target.paymentStatus === "created"
    ) {
      const cancelledPayment = await cancelPaymentById(target.paymentId);
      if (cancelledPayment.status === "approved") {
        await refundPaymentById(target.paymentId, target.total);
        updated.paymentStatus = "refunded";
      } else {
        const mapped = mapPaymentToOrderStatus(cancelledPayment.status);
        updated.paymentStatus = mapped.paymentStatus;
      }
      updated.status = "cancelled";
    } else if (target.paymentStatus === "refunded") {
      updated.paymentStatus = "refunded";
    } else {
      updated.paymentStatus = "cancelled";
    }
  } else {
    updated.paymentStatus = target.paymentStatus === "approved" ? "refunded" : "cancelled";
  }

  return updated;
}

function updateOrderStatusByAdmin(target: Order, nextStatus: Exclude<AdminOrderStatus, "cancelled">): Order {
  if (target.status === "cancelled") {
    throw new Error("Pedido cancelado nao pode ser atualizado.");
  }
  return {
    ...target,
    status: nextStatus,
    notes: appendNote(target.notes, `Status atualizado pelo admin: ${nextStatus}`),
    updatedAt: new Date().toISOString()
  };
}

function shouldSyncPaymentStatus(order: Order): boolean {
  if (!order.paymentId) return false;
  if (order.paymentMethod === "whatsapp") return false;
  const isPendingPaymentStatus =
    order.paymentStatus === "created" ||
    order.paymentStatus === "pending" ||
    order.paymentStatus === "in_process";
  return isPendingPaymentStatus || order.status === "pending_payment";
}

async function syncOrderPaymentStatusIfNeeded(input: {
  order: Order;
  orders: Order[];
}): Promise<{ order: Order; orders: Order[] }> {
  const { order, orders } = input;
  if (!shouldSyncPaymentStatus(order)) {
    return { order, orders };
  }

  try {
    const payment = await getPaymentById(order.paymentId || "");
    const mapped = mapPaymentToOrderStatus(payment.status);
    const wasCancelled = order.status === "cancelled";
    const isOperationalFlow = order.status === "preparing" || order.status === "shipped";
    let nextPaymentStatus = mapped.paymentStatus;
    let nextOrderStatus = mapped.orderStatus;

    if (wasCancelled && payment.status === "approved") {
      await refundPaymentById(String(payment.id), order.total);
      nextPaymentStatus = "refunded";
      nextOrderStatus = "cancelled";
    } else if (wasCancelled) {
      nextOrderStatus = "cancelled";
      if (payment.status === "refunded") {
        nextPaymentStatus = "refunded";
      }
    } else if (isOperationalFlow) {
      const paymentEndedAsFailure = mapped.orderStatus === "cancelled" || mapped.orderStatus === "failed";
      nextOrderStatus = paymentEndedAsFailure ? mapped.orderStatus : order.status;
    }

    const changed =
      order.paymentId !== String(payment.id) ||
      order.paymentStatus !== nextPaymentStatus ||
      order.status !== nextOrderStatus;

    if (!changed) {
      return { order, orders };
    }

    const updated: Order = {
      ...order,
      paymentId: String(payment.id),
      paymentStatus: nextPaymentStatus,
      status: nextOrderStatus,
      updatedAt: new Date().toISOString()
    };
    const nextOrders = orders.map((item) => (item.id === order.id ? updated : item));
    await writeOrders(nextOrders);

    if (order.status !== updated.status || order.paymentStatus !== updated.paymentStatus) {
      await sendOrderStatusNotifications(updated);
    }

    return { order: updated, orders: nextOrders };
  } catch {
    return { order, orders };
  }
}

export default async function handler(req: any, res: any) {
  try {
    const mode = getQueryParam(req.query?.mode);

    if (req.method === "GET" && mode === "admin_all") {
      assertAdminAccess(req);
      const orders = await readOrders();
      const customers = await readCustomers();
      return json(res, 200, withCustomerPhoneFallback(orders, customers));
    }

    if (req.method === "PATCH" && mode === "admin_update") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }
      const body = (await readJsonBody(req)) as {
        status?: string;
        reason?: string;
        forceUnpaidTransition?: boolean;
      };
      const nextStatus = parseAdminStatus(body.status);
      if (!nextStatus) {
        return json(res, 400, { error: "Status invalido para atualizacao admin." });
      }
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";

      const orders = await readOrders();
      const target = orders.find((order) => order.id === id);
      if (!target) {
        return json(res, 404, { error: "Pedido nao encontrado." });
      }

      const isPaid = target.paymentStatus === "approved";
      if ((nextStatus === "preparing" || nextStatus === "shipped") && !isPaid) {
        if (body.forceUnpaidTransition !== true) {
          return json(res, 409, {
            error:
              "Pedido nao foi pago. Confirme explicitamente para avancar mesmo sem pagamento."
          });
        }
      }

      const updated =
        nextStatus === "cancelled"
          ? await cancelOrderWithPayment(target, reason, "admin")
          : updateOrderStatusByAdmin(target, nextStatus);

      await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
      await sendOrderStatusNotifications(updated);
      return json(res, 200, updated);
    }

    if (req.method === "PATCH" && mode === "admin_tracking") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }
      const body = (await readJsonBody(req)) as {
        trackingCode?: unknown;
        trackingUrl?: unknown;
      };

      const trackingCode = normalizeTrackingCode(body.trackingCode);
      const trackingUrl = normalizeTrackingUrl(body.trackingUrl);
      const hasTrackingCode = body.trackingCode !== undefined;
      const hasTrackingUrl = body.trackingUrl !== undefined;
      if (!hasTrackingCode && !hasTrackingUrl) {
        return json(res, 400, { error: "Nada para atualizar no rastreio." });
      }
      if (hasTrackingUrl && body.trackingUrl && !trackingUrl) {
        return json(res, 400, { error: "Link de rastreio invalido." });
      }

      const orders = await readOrders();
      const target = orders.find((order) => order.id === id);
      if (!target) {
        return json(res, 404, { error: "Pedido nao encontrado." });
      }

      const updated: Order = {
        ...target,
        trackingCode: hasTrackingCode ? trackingCode : target.trackingCode,
        trackingUrl: hasTrackingUrl ? trackingUrl : target.trackingUrl,
        notes: appendNote(target.notes, "Rastreio atualizado pelo admin."),
        updatedAt: new Date().toISOString()
      };

      await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
      await sendOrderStatusNotifications(updated);
      return json(res, 200, updated);
    }

    if (req.method === "DELETE" && mode === "admin_delete") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }

      const orders = await readOrders();
      const target = orders.find((order) => order.id === id);
      if (!target) {
        return json(res, 404, { error: "Pedido nao encontrado." });
      }

      await writeOrders(orders.filter((order) => order.id !== id));
      return json(res, 204, null);
    }

    const authed = await requireAuthedCustomer(req, res);
    if (!authed) return;

    if (req.method === "GET") {
      const id = getQueryParam(req.query?.id);
      const orders = await readOrders();
      const ownOrders = orders.filter((order) => order.customerId === authed.id);
      if (!id) {
        return json(res, 200, ownOrders);
      }
      const found = ownOrders.find((order) => order.id === id);
      if (!found) {
        return json(res, 200, null);
      }

      const synced = await syncOrderPaymentStatusIfNeeded({
        order: found,
        orders
      });
      return json(res, 200, synced.order);
    }

    if (req.method === "POST") {
      if (mode === "resume_payment") {
        const id = getQueryParam(req.query?.id);
        if (!id) {
          return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
        }

        const orders = await readOrders();
        const target = orders.find((order) => order.id === id && order.customerId === authed.id);
        if (!target) {
          return json(res, 404, { error: "Pedido nao encontrado." });
        }
        if (!canCustomerRetryPayment(target)) {
          return json(res, 400, { error: "Pedido nao esta pendente de pagamento." });
        }

        if (target.paymentMethod === "whatsapp") {
          return json(res, 400, {
            error: "Pedidos via WhatsApp devem ser finalizados no atendimento."
          });
        }

        if (
          target.paymentMethod === "pix" &&
          (target.paymentStatus === "created" ||
            target.paymentStatus === "pending" ||
            target.paymentStatus === "in_process") &&
          target.pixQrCodeBase64
        ) {
          return json(res, 200, target);
        }

        if (
          target.paymentMethod === "credit_card" &&
          (target.paymentStatus === "created" ||
            target.paymentStatus === "pending" ||
            target.paymentStatus === "in_process") &&
          target.checkoutUrl
        ) {
          return json(res, 200, target);
        }

        let updated: Order = {
          ...target,
          updatedAt: new Date().toISOString()
        };

        if (target.paymentMethod === "pix") {
          const cpf = onlyDigits(target.customerCpf || "");
          if (cpf.length !== 11) {
            return json(res, 400, {
              error: "Pedido PIX sem CPF valido. Entre em contato com o suporte."
            });
          }
          const pix = await createPixPayment({ order: target, cpf, req });
          const mapped = mapPaymentToOrderStatus(pix.paymentStatus);
          updated = {
            ...updated,
            paymentId: pix.paymentId,
            paymentStatus: mapped.paymentStatus,
            status: mapped.orderStatus,
            pixQrCode: pix.qrCode,
            pixQrCodeBase64: pix.qrCodeBase64,
            externalReference: target.id
          };
        } else if (target.paymentMethod === "credit_card") {
          const preference = await createCardPreference({ order: target, req });
          updated = {
            ...updated,
            preferenceId: preference.preferenceId,
            checkoutUrl: preference.checkoutUrl,
            paymentStatus: "pending",
            status: "pending_payment",
            externalReference: target.id
          };
        }

        await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
        return json(res, 200, updated);
      }

      const body = (await readJsonBody(req)) as {
        items?: unknown;
        address?: Partial<Address>;
        shippingAmount?: number;
        couponCode?: string;
        paymentMethod?: CheckoutPaymentMethod;
        cpf?: string;
        notes?: string;
        saveAddress?: boolean;
      };

      const items = normalizeItems(body.items);
      if (!items.length) {
        return json(res, 400, { error: "Carrinho vazio." });
      }

      const address = normalizeAddress(body.address || {});
      const addressError = validateAddress(address);
      if (addressError) {
        return json(res, 400, { error: addressError });
      }

      const paymentMethod = body.paymentMethod || "whatsapp";
      if (!["whatsapp", "pix", "credit_card"].includes(paymentMethod)) {
        return json(res, 400, { error: "Metodo de pagamento invalido." });
      }

      const subtotal = Number(computeSubtotal(items).toFixed(2));
      const shippingOriginalAmount = Number(Math.max(0, parseNumber(body.shippingAmount, 0)).toFixed(2));
      const couponCode = normalizeCouponCode(body.couponCode || "");
      const coupons = couponCode ? await readCoupons() : [];
      const selectedCoupon = couponCode
        ? coupons.find((coupon) => coupon.code === couponCode && coupon.active)
        : null;
      if (couponCode && !selectedCoupon) {
        return json(res, 400, { error: "Cupom invalido ou inativo." });
      }

      const couponResult = selectedCoupon
        ? calculateCouponDiscount({
            coupon: selectedCoupon,
            subtotal,
            shippingAmount: shippingOriginalAmount
          })
        : {
            discountAmount: 0,
            shippingAmount: shippingOriginalAmount,
            shippingOriginalAmount,
            total: Number((subtotal + shippingOriginalAmount).toFixed(2))
          };

      const shippingAmount = couponResult.shippingAmount;
      const total = couponResult.total;
      const now = new Date().toISOString();
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 800) : "";

      const order: Order = {
        id: generateId("ord"),
        customerId: authed.id,
        customerName: authed.name,
        customerEmail: authed.email,
        customerPhone: onlyDigits((authed as any).phone || "") || undefined,
        customerCpf: onlyDigits(body.cpf || ""),
        items,
        address,
        shippingOriginalAmount: couponResult.shippingOriginalAmount,
        shippingAmount,
        subtotal,
        discountAmount: couponResult.discountAmount || undefined,
        couponCode: selectedCoupon?.code,
        couponType: selectedCoupon?.type,
        total,
        paymentMethod,
        paymentStatus: "created",
        status: "pending_payment",
        notes: notes || undefined,
        createdAt: now,
        updatedAt: now
      };

      if (paymentMethod === "pix") {
        const cpf = onlyDigits(body.cpf || "");
        if (cpf.length !== 11) {
          return json(res, 400, { error: "Informe um CPF valido para pagamento PIX." });
        }
        const pix = await createPixPayment({ order, cpf, req });
        const mapped = mapPaymentToOrderStatus(pix.paymentStatus);
        order.paymentId = pix.paymentId;
        order.paymentStatus = mapped.paymentStatus;
        order.status = mapped.orderStatus;
        order.pixQrCode = pix.qrCode;
        order.pixQrCodeBase64 = pix.qrCodeBase64;
        order.externalReference = order.id;
      } else if (paymentMethod === "credit_card") {
        const preference = await createCardPreference({ order, req });
        order.preferenceId = preference.preferenceId;
        order.checkoutUrl = preference.checkoutUrl;
        order.paymentStatus = "pending";
        order.status = "pending_payment";
        order.externalReference = order.id;
      } else {
        order.paymentStatus = "created";
        order.status = "pending_payment";
      }

      const existingOrders = await readOrders();
      await writeOrders([order, ...existingOrders]);

      if (body.saveAddress !== false) {
        const customers = await readCustomers();
        const customerIndex = customers.findIndex((item) => item.id === authed.id);
        if (customerIndex >= 0) {
          const current = customers[customerIndex];
          const alreadySaved = current.addresses.some((saved) => areAddressesEqual(saved, address));
          if (!alreadySaved) {
            customers[customerIndex] = {
              ...current,
              addresses: [address, ...current.addresses],
              updatedAt: new Date().toISOString()
            };
            await writeCustomers(customers);
          }
        }
      }

      await sendOrderNotifications(order);
      return json(res, 201, order);
    }

    if (req.method === "PATCH") {
      if (mode !== "cancel") {
        return json(res, 400, { error: "Modo invalido." });
      }
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }
      const body = (await readJsonBody(req)) as { reason?: string };
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";

      const orders = await readOrders();
      const target = orders.find((order) => order.id === id && order.customerId === authed.id);
      if (!target) {
        return json(res, 404, { error: "Pedido nao encontrado." });
      }
      if (target.status === "cancelled") {
        return json(res, 200, target);
      }
      if (!canCustomerCancelOrder(target)) {
        return json(res, 403, {
          error: "Pedido em preparacao/envio so pode ser cancelado pelo admin."
        });
      }

      const updated = await cancelOrderWithPayment(target, reason, "cliente");
      await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
      await sendOrderStatusNotifications(updated);
      return json(res, 200, updated);
    }

    res.setHeader("Allow", "GET,POST,PATCH,DELETE");
    return json(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message === "Nao autorizado." ? 401 : 500;
    return json(res, status, { error: message });
  }
}
