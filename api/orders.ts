import type { Address } from "../src/types/customer";
import type { CartItem } from "../src/types/cart";
import type { CheckoutPaymentMethod, Order } from "../src/types/order";
import { getQueryParam, json, normalizeCep, onlyDigits, parseNumber, readJsonBody } from "./_lib/http.js";
import { requireAuthedCustomer } from "./_lib/customerAuth.js";
import { getAdminEmail, sendEmail } from "./_lib/email.js";
import {
  cancelPaymentById,
  createCardPreference,
  createPixPayment,
  mapPaymentToOrderStatus,
  refundPaymentById
} from "./_lib/mercadopago.js";
import { buildOrderEmail } from "./_lib/orderEmail.js";
import { generateId } from "./_lib/security.js";
import { readCustomers, readOrders, writeCustomers, writeOrders } from "./_lib/store.js";

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

async function sendOrderNotifications(order: Order): Promise<void> {
  const email = buildOrderEmail(order);
  await Promise.allSettled([
    sendEmail({
      to: order.customerEmail,
      subject: `Confirmacao do pedido ${order.id}`,
      html: email.html,
      text: email.text
    }),
    sendEmail({
      to: getAdminEmail(),
      subject: `Novo pedido ${order.id}`,
      html: email.html,
      text: email.text
    })
  ]);
}

async function sendOrderStatusNotifications(order: Order): Promise<void> {
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
      subject: `Atualizacao do pedido ${order.id}`,
      html: email.html,
      text: email.text
    })
  ]);
}

export default async function handler(req: any, res: any) {
  try {
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
      return json(res, 200, found || null);
    }

    if (req.method === "POST") {
      const body = (await readJsonBody(req)) as {
        items?: unknown;
        address?: Partial<Address>;
        shippingAmount?: number;
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
      const shippingAmount = Number(Math.max(0, parseNumber(body.shippingAmount, 0)).toFixed(2));
      const total = Number((subtotal + shippingAmount).toFixed(2));
      const now = new Date().toISOString();
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 800) : "";

      const order: Order = {
        id: generateId("ord"),
        customerId: authed.id,
        customerName: authed.name,
        customerEmail: authed.email,
        customerCpf: onlyDigits(body.cpf || ""),
        items,
        address,
        shippingAmount,
        subtotal,
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
      const mode = getQueryParam(req.query?.mode);
      if (mode !== "cancel") {
        return json(res, 400, { error: "Modo invalido." });
      }
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parâmetro 'id' é obrigatório." });
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

      const updated: Order = {
        ...target,
        status: "cancelled",
        notes: [target.notes, reason ? `Cancelamento: ${reason}` : ""].filter(Boolean).join("\n"),
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

      await writeOrders(orders.map((order) => (order.id === target.id ? updated : order)));
      await sendOrderStatusNotifications(updated);
      return json(res, 200, updated);
    }

    res.setHeader("Allow", "GET,POST,PATCH");
    return json(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return json(res, 500, { error: message });
  }
}
