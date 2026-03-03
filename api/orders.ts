import type { Address } from "../src/types/customer";
import type { CartItem } from "../src/types/cart";
import type { CheckoutPaymentMethod, Order } from "../src/types/order";
import type { Product } from "../src/types/product";
import type { Fragrance } from "../src/types/fragrance";
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
import { readProductsCatalog } from "./_lib/products.js";
import { calculateFreight } from "./_lib/shipping.js";
import {
  readCoupons,
  readCustomers,
  readFragrances,
  readOrders,
  withCustomersLock,
  withOrdersLock,
  writeCustomers,
  writeOrders
} from "./_lib/store.js";

type AdminOrderStatus = Extract<Order["status"], "preparing" | "shipped" | "cancelled">;
type RequestedCartItem = {
  productId: string;
  quantity: number;
  variant?: string;
  fragrance?: string;
};

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

function normalizeText(value: unknown, maxLength = 120): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeRequestedItems(value: unknown): RequestedCartItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = (item || {}) as Record<string, unknown>;
      return {
        productId: normalizeText(raw.productId, 80),
        quantity: Math.max(1, Math.min(99, Math.round(parseNumber(raw.quantity, 1)))),
        variant: normalizeText(raw.variant, 80) || undefined,
        fragrance: normalizeText(raw.fragrance, 80) || undefined
      } satisfies RequestedCartItem;
    })
    .filter((item) => Boolean(item.productId));
}

function findCaseInsensitive(options: string[], requested: string): string | undefined {
  const target = requested.trim().toLowerCase();
  if (!target) return undefined;
  return options.find((item) => item.trim().toLowerCase() === target);
}

function canonicalizeOrderItems(input: {
  requestedItems: RequestedCartItem[];
  products: Product[];
  fragrances: Fragrance[];
}): { items?: CartItem[]; error?: string } {
  if (!input.requestedItems.length) {
    return { error: "Carrinho vazio." };
  }

  const productsById = new Map<string, Product>();
  for (const product of input.products) {
    productsById.set(product.id, product);
  }

  const activeFragrances = new Map<string, string>();
  for (const fragrance of input.fragrances) {
    if (fragrance.active) {
      activeFragrances.set(fragrance.name.trim().toLowerCase(), fragrance.name);
    }
  }

  const items: CartItem[] = [];
  for (const requested of input.requestedItems) {
    const product = productsById.get(requested.productId);
    if (!product) {
      return { error: "Carrinho contem produto invalido." };
    }
    if (!product.inStock) {
      return { error: `O produto "${product.name}" esta sem estoque.` };
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    let variant: string | undefined;
    if (variants.length > 0) {
      if (!requested.variant) {
        return { error: `Selecione a variante para "${product.name}".` };
      }
      const matchedVariant = findCaseInsensitive(variants, requested.variant);
      if (!matchedVariant) {
        return { error: `Variante invalida para "${product.name}".` };
      }
      variant = matchedVariant;
    }

    let fragrance: string | undefined;
    if (requested.fragrance) {
      const matchedFragrance = activeFragrances.get(requested.fragrance.trim().toLowerCase());
      if (!matchedFragrance) {
        return { error: `Fragrancia invalida para "${product.name}".` };
      }
      fragrance = matchedFragrance;
    }

    items.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price.toFixed(2)),
      quantity: requested.quantity,
      image: Array.isArray(product.images) && product.images.length ? product.images[0] : undefined,
      variant,
      fragrance
    });
  }

  return { items };
}

function computeSubtotal(items: CartItem[]): number {
  return Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
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
  return order.status === "pending_payment" || order.status === "paid" || order.status === "failed";
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

function normalizeTrackingCarrier(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N}\s().\-\/&]/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return normalized || undefined;
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

async function sendTrackingUpdateNotifications(order: Order): Promise<void> {
  const customerEmail = buildOrderEmail(order, "customer");
  const adminEmail = buildOrderEmail(order, "admin");
  const result = await sendCustomerAdminPair({
    customer: {
      to: order.customerEmail,
      subject: `Rastreio atualizado - ${order.id}`,
      html: customerEmail.html,
      text: customerEmail.text
    },
    admin: {
      to: getAdminEmail(),
      subject: `Rastreio atualizado (admin) - ${order.id}`,
      html: adminEmail.html,
      text: adminEmail.text
    }
  });
  if (!result.customer.ok) {
    console.error(`[email] Cliente nao recebeu atualizacao de rastreio do pedido ${order.id}.`);
  }
  if (!result.admin.ok) {
    console.error(`[email] Admin nao recebeu atualizacao de rastreio do pedido ${order.id}.`);
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

function getAllowedAdminTransitions(current: Order["status"]): AdminOrderStatus[] {
  switch (current) {
    case "pending_payment":
    case "paid":
      return ["preparing", "shipped", "cancelled"];
    case "failed":
      return ["preparing", "cancelled"];
    case "preparing":
      return ["preparing", "shipped", "cancelled"];
    case "shipped":
      return ["shipped", "cancelled"];
    case "cancelled":
      return [];
    default:
      return [];
  }
}

function updateOrderStatusByAdmin(
  target: Order,
  nextStatus: Exclude<AdminOrderStatus, "cancelled">,
  note?: string
): Order {
  const allowed = getAllowedAdminTransitions(target.status);
  if (!allowed.length) {
    throw new Error("Pedido cancelado nao pode ser atualizado.");
  }
  if (!allowed.includes(nextStatus)) {
    throw new Error("Transicao de status nao permitida para o estado atual.");
  }

  return {
    ...target,
    status: nextStatus,
    notes: note ? appendNote(target.notes, note) : target.notes,
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

function mapOrderWithPaymentState(order: Order, payment: { id: string | number; status: any }): Order {
  const mapped = mapPaymentToOrderStatus(payment.status);
  const wasCancelled = order.status === "cancelled";
  const isOperationalFlow = order.status === "preparing" || order.status === "shipped";
  let nextPaymentStatus = mapped.paymentStatus;
  let nextOrderStatus = mapped.orderStatus;

  if (wasCancelled) {
    nextOrderStatus = "cancelled";
    if (payment.status === "refunded") {
      nextPaymentStatus = "refunded";
    }
  } else if (isOperationalFlow) {
    const paymentEndedAsFailure = mapped.orderStatus === "cancelled" || mapped.orderStatus === "failed";
    nextOrderStatus = paymentEndedAsFailure ? mapped.orderStatus : order.status;
  }

  return {
    ...order,
    paymentId: String(payment.id),
    paymentStatus: nextPaymentStatus,
    status: nextOrderStatus,
    updatedAt: new Date().toISOString()
  };
}

async function syncOrderPaymentStatusIfNeeded(input: {
  order: Order;
  customerId: string;
}): Promise<Order> {
  const { order, customerId } = input;
  if (!shouldSyncPaymentStatus(order)) {
    return order;
  }

  try {
    const payment = await getPaymentById(order.paymentId || "");
    const result = await withOrdersLock(async () => {
      const orders = await readOrders();
      const target = orders.find((item) => item.id === order.id && item.customerId === customerId);
      if (!target) {
        return { kind: "not-found" as const, order };
      }

      let updated = mapOrderWithPaymentState(target, payment);
      if (target.status === "cancelled" && payment.status === "approved") {
        await refundPaymentById(String(payment.id), target.total);
        updated = {
          ...updated,
          paymentStatus: "refunded",
          status: "cancelled",
          updatedAt: new Date().toISOString()
        };
      }

      const changed =
        target.paymentId !== updated.paymentId ||
        target.paymentStatus !== updated.paymentStatus ||
        target.status !== updated.status;

      if (!changed) {
        return { kind: "unchanged" as const, order: target };
      }

      await writeOrders(orders.map((item) => (item.id === target.id ? updated : item)));
      const shouldNotify = target.status !== updated.status || target.paymentStatus !== updated.paymentStatus;
      return { kind: "updated" as const, order: updated, shouldNotify };
    }, { ttlSeconds: 45 });

    if (result.kind === "updated" && result.shouldNotify) {
      await sendOrderStatusNotifications(result.order);
    }

    return result.order;
  } catch {
    return order;
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
        note?: string;
        forceUnpaidTransition?: boolean;
      };
      const nextStatus = parseAdminStatus(body.status);
      if (!nextStatus) {
        return json(res, 400, { error: "Status invalido para atualizacao admin." });
      }
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

      const result = await withOrdersLock(async () => {
        const orders = await readOrders();
        const target = orders.find((order) => order.id === id);
        if (!target) {
          return { status: 404, body: { error: "Pedido nao encontrado." } } as const;
        }

        const allowed = getAllowedAdminTransitions(target.status);
        if (!allowed.includes(nextStatus)) {
          return {
            status: 409,
            body: { error: "Transicao de status nao permitida para o estado atual." }
          } as const;
        }

        const isPaid = target.paymentStatus === "approved";
        if ((nextStatus === "preparing" || nextStatus === "shipped") && !isPaid) {
          if (body.forceUnpaidTransition !== true) {
            return {
              status: 409,
              body: {
                error: "Pedido nao foi pago. Confirme explicitamente para avancar mesmo sem pagamento."
              }
            } as const;
          }
        }

        const updated =
          nextStatus === "cancelled"
            ? await cancelOrderWithPayment(target, reason, "admin")
            : updateOrderStatusByAdmin(target, nextStatus, note);

        await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
        return { status: 200, body: updated, shouldNotify: true } as const;
      }, { ttlSeconds: 45 });

      if ("shouldNotify" in result && result.shouldNotify) {
        await sendOrderStatusNotifications(result.body);
      }
      return json(res, result.status, result.body);
    }

    if (req.method === "PATCH" && mode === "admin_tracking") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }
      const body = (await readJsonBody(req)) as {
        trackingCarrier?: unknown;
        trackingCode?: unknown;
        trackingUrl?: unknown;
        note?: unknown;
      };

      const trackingCarrier = normalizeTrackingCarrier(body.trackingCarrier);
      const trackingCode = normalizeTrackingCode(body.trackingCode);
      const trackingUrl = normalizeTrackingUrl(body.trackingUrl);
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
      const hasTrackingCarrier = body.trackingCarrier !== undefined;
      const hasTrackingCode = body.trackingCode !== undefined;
      const hasTrackingUrl = body.trackingUrl !== undefined;
      const hasCustomNote = Boolean(note);
      if (!hasTrackingCarrier && !hasTrackingCode && !hasTrackingUrl && !hasCustomNote) {
        return json(res, 400, { error: "Nada para atualizar no rastreio." });
      }
      if (hasTrackingUrl && body.trackingUrl && !trackingUrl) {
        return json(res, 400, { error: "Link de rastreio invalido." });
      }

      const result = await withOrdersLock(async () => {
        const orders = await readOrders();
        const target = orders.find((order) => order.id === id);
        if (!target) {
          return { status: 404, body: { error: "Pedido nao encontrado." } } as const;
        }

        const trackingCarrierChanged = hasTrackingCarrier && trackingCarrier !== target.trackingCarrier;
        const trackingCodeChanged = hasTrackingCode && trackingCode !== target.trackingCode;
        const trackingUrlChanged = hasTrackingUrl && trackingUrl !== target.trackingUrl;
        if (!trackingCarrierChanged && !trackingCodeChanged && !trackingUrlChanged && !hasCustomNote) {
          return { status: 200, body: target, shouldNotify: false } as const;
        }

        const updated: Order = {
          ...target,
          trackingCarrier: hasTrackingCarrier ? trackingCarrier : target.trackingCarrier,
          trackingCode: hasTrackingCode ? trackingCode : target.trackingCode,
          trackingUrl: hasTrackingUrl ? trackingUrl : target.trackingUrl,
          notes: hasCustomNote ? appendNote(target.notes, note) : target.notes,
          updatedAt: new Date().toISOString()
        };

        await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
        return { status: 200, body: updated, shouldNotify: true } as const;
      }, { ttlSeconds: 45 });

      if ("shouldNotify" in result && result.shouldNotify) {
        await sendTrackingUpdateNotifications(result.body);
      }
      return json(res, result.status, result.body);
    }

    if (req.method === "DELETE" && mode === "admin_delete") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
      }

      const result = await withOrdersLock(async () => {
        const orders = await readOrders();
        const target = orders.find((order) => order.id === id);
        if (!target) {
          return { status: 404, body: { error: "Pedido nao encontrado." } } as const;
        }

        await writeOrders(orders.filter((order) => order.id !== id));
        return { status: 204, body: null } as const;
      });

      return json(res, result.status, result.body);
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
        customerId: authed.id
      });
      return json(res, 200, synced);
    }

    if (req.method === "POST") {
      if (mode === "resume_payment") {
        const id = getQueryParam(req.query?.id);
        if (!id) {
          return json(res, 400, { error: "Parametro 'id' e obrigatorio." });
        }

        const result = await withOrdersLock(async () => {
          const orders = await readOrders();
          const target = orders.find((order) => order.id === id && order.customerId === authed.id);
          if (!target) {
            return { status: 404, body: { error: "Pedido nao encontrado." } } as const;
          }
          if (!canCustomerRetryPayment(target)) {
            return { status: 400, body: { error: "Pedido nao esta pendente de pagamento." } } as const;
          }

          if (target.paymentMethod === "whatsapp") {
            return {
              status: 400,
              body: { error: "Pedidos via WhatsApp devem ser finalizados no atendimento." }
            } as const;
          }

          if (
            target.paymentMethod === "pix" &&
            (target.paymentStatus === "created" ||
              target.paymentStatus === "pending" ||
              target.paymentStatus === "in_process") &&
            target.pixQrCodeBase64
          ) {
            return { status: 200, body: target } as const;
          }

          if (
            target.paymentMethod === "credit_card" &&
            (target.paymentStatus === "created" ||
              target.paymentStatus === "pending" ||
              target.paymentStatus === "in_process") &&
            target.checkoutUrl
          ) {
            return { status: 200, body: target } as const;
          }

          let updated: Order = {
            ...target,
            updatedAt: new Date().toISOString()
          };

          if (target.paymentMethod === "pix") {
            const cpf = onlyDigits(target.customerCpf || "");
            if (cpf.length !== 11) {
              return {
                status: 400,
                body: {
                  error: "Pedido PIX sem CPF valido. Entre em contato com o suporte."
                }
              } as const;
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
          return { status: 200, body: updated } as const;
        }, { ttlSeconds: 45 });

        return json(res, result.status, result.body);
      }

      const body = (await readJsonBody(req)) as {
        items?: unknown;
        address?: Partial<Address>;
        couponCode?: string;
        paymentMethod?: CheckoutPaymentMethod;
        cpf?: string;
        notes?: string;
        saveAddress?: boolean;
      };

      const requestedItems = normalizeRequestedItems(body.items);
      if (!requestedItems.length) {
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

      const [products, fragrances] = await Promise.all([readProductsCatalog(), readFragrances()]);
      const canonicalized = canonicalizeOrderItems({
        requestedItems,
        products,
        fragrances
      });
      if (!canonicalized.items) {
        return json(res, 400, { error: canonicalized.error || "Carrinho invalido." });
      }

      const items = canonicalized.items;
      const subtotal = computeSubtotal(items);
      const shippingOriginalAmount = Number(calculateFreight(address.cep, subtotal).amount.toFixed(2));
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

      await withOrdersLock(async () => {
        const existingOrders = await readOrders();
        await writeOrders([order, ...existingOrders]);
      });

      if (body.saveAddress !== false) {
        await withCustomersLock(async () => {
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
        });
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

      const result = await withOrdersLock(async () => {
        const orders = await readOrders();
        const target = orders.find((order) => order.id === id && order.customerId === authed.id);
        if (!target) {
          return { status: 404, body: { error: "Pedido nao encontrado." } } as const;
        }
        if (target.status === "cancelled") {
          return { status: 200, body: target } as const;
        }
        if (!canCustomerCancelOrder(target)) {
          return {
            status: 403,
            body: { error: "Pedido em preparacao/envio so pode ser cancelado pelo admin." }
          } as const;
        }

        const updated = await cancelOrderWithPayment(target, reason, "cliente");
        await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
        return { status: 200, body: updated, shouldNotify: true } as const;
      }, { ttlSeconds: 45 });

      if ("shouldNotify" in result && result.shouldNotify) {
        await sendOrderStatusNotifications(result.body);
      }
      return json(res, result.status, result.body);
    }

    res.setHeader("Allow", "GET,POST,PATCH,DELETE");
    return json(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message === "Nao autorizado." ? 401 : 500;
    return json(res, status, { error: message });
  }
}
