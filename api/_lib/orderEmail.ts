import type { Order } from "../../src/types/order";

type EmailAudience = "customer" | "admin";
type OrderEmailStage =
  | "order_received"
  | "payment_confirmed"
  | "preparing"
  | "shipped"
  | "payment_failed"
  | "cancelled";

type StageTheme = {
  customerSubject: string;
  adminSubject: string;
  customerHeadline: string;
  adminHeadline: string;
  statusLabel: string;
  badgeLabel: string;
  accentColor: string;
  softColor: string;
  symbol: string;
};

const BRAND_INSTAGRAM = "@_encarartes";
const BRAND_PHONE = "(32) 99110-9045";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

function paymentStatusLabel(status: Order["paymentStatus"]): string {
  if (status === "approved") return "Aprovado";
  if (status === "pending" || status === "in_process" || status === "created") return "Pendente";
  if (status === "rejected") return "Recusado";
  if (status === "cancelled") return "Cancelado";
  if (status === "refunded") return "Estornado";
  if (status === "charged_back") return "Chargeback";
  return status;
}

function paymentMethodLabel(method: Order["paymentMethod"]): string {
  if (method === "pix") return "PIX";
  if (method === "credit_card") return "Cartao de credito";
  return "WhatsApp";
}

function getStage(order: Order): OrderEmailStage {
  if (order.status === "cancelled" || order.paymentStatus === "cancelled" || order.paymentStatus === "refunded") {
    return "cancelled";
  }
  if (order.status === "failed" || order.paymentStatus === "rejected") {
    return "payment_failed";
  }
  if (order.status === "shipped") {
    return "shipped";
  }
  if (order.status === "preparing") {
    return "preparing";
  }
  if (order.status === "paid" || order.paymentStatus === "approved") {
    return "payment_confirmed";
  }
  return "order_received";
}

function stageTheme(stage: OrderEmailStage): StageTheme {
  if (stage === "shipped") {
    return {
      customerSubject: "Pedido enviado",
      adminSubject: "Pedido enviado (admin)",
      customerHeadline: "Seu pedido foi enviado e esta a caminho.",
      adminHeadline: "Pedido marcado como enviado para o cliente.",
      statusLabel: "Pedido enviado",
      badgeLabel: "ENVIADO",
      accentColor: "#3E6BA5",
      softColor: "#EDF4FF",
      symbol: "SHIP"
    };
  }
  if (stage === "preparing") {
    return {
      customerSubject: "Pedido em preparacao",
      adminSubject: "Pedido em preparacao (admin)",
      customerHeadline: "Pagamento confirmado. Seu pedido ja esta em preparacao.",
      adminHeadline: "Pedido em preparacao na operacao da loja.",
      statusLabel: "Em preparacao",
      badgeLabel: "PREPARO",
      accentColor: "#A16B2A",
      softColor: "#FFF4E8",
      symbol: "PREP"
    };
  }
  if (stage === "payment_confirmed") {
    return {
      customerSubject: "Pagamento confirmado",
      adminSubject: "Pagamento confirmado (admin)",
      customerHeadline: "Pagamento confirmado com sucesso. Vamos preparar seu pedido.",
      adminHeadline: "Pagamento aprovado para este pedido.",
      statusLabel: "Pagamento aprovado",
      badgeLabel: "PAGO",
      accentColor: "#2F7F4F",
      softColor: "#EAF8EF",
      symbol: "OK"
    };
  }
  if (stage === "payment_failed") {
    return {
      customerSubject: "Pagamento nao aprovado",
      adminSubject: "Pagamento recusado (admin)",
      customerHeadline: "Nao conseguimos confirmar o pagamento. Voce pode tentar novamente na sua conta.",
      adminHeadline: "Pagamento recusado ou com falha para este pedido.",
      statusLabel: "Pagamento recusado",
      badgeLabel: "FALHA",
      accentColor: "#A33E3E",
      softColor: "#FDEEEE",
      symbol: "ERRO"
    };
  }
  if (stage === "cancelled") {
    return {
      customerSubject: "Pedido cancelado",
      adminSubject: "Pedido cancelado (admin)",
      customerHeadline: "Seu pedido foi cancelado. Se precisar, fale com nosso atendimento.",
      adminHeadline: "Pedido cancelado no sistema.",
      statusLabel: "Pedido cancelado",
      badgeLabel: "CANCELADO",
      accentColor: "#5E646D",
      softColor: "#F2F4F7",
      symbol: "X"
    };
  }
  return {
    customerSubject: "Pedido recebido",
    adminSubject: "Novo pedido",
    customerHeadline: "Recebemos seu pedido e estamos aguardando a confirmacao do pagamento.",
    adminHeadline: "Novo pedido criado e aguardando confirmacao de pagamento.",
    statusLabel: "Aguardando pagamento",
    badgeLabel: "NOVO",
    accentColor: "#8A5A24",
    softColor: "#FFF5EA",
    symbol: "NOVO"
  };
}

function buildOrderLabel(orderId: string): string {
  const token = orderId.split("_")[1] || orderId;
  return token.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function buildBrandLogoSvg(): string {
  return `
    <svg width="220" height="146" viewBox="0 0 220 146" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo EncantArtes">
      <g fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M110 15C100 31 98 43 110 53C122 43 120 31 110 15Z" />
        <path d="M110 33C106 41 106 47 110 51C114 47 114 41 110 33Z" />
        <rect x="95" y="54" width="30" height="45" rx="5" />
        <path d="M80 36L80 44M76 40L84 40" />
        <path d="M140 36L140 44M136 40L144 40" />
        <path d="M72 54L72 60M68 57L76 57" />
        <path d="M148 54L148 60M144 57L152 57" />
      </g>
      <text x="110" y="122" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="#111111">EncantArtes</text>
      <text x="110" y="140" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="11" fill="#333333">${escapeHtml(BRAND_INSTAGRAM)} · ${escapeHtml(BRAND_PHONE)}</text>
    </svg>
  `;
}

function buildCandleIllustration(theme: StageTheme): string {
  const safeAccent = escapeHtml(theme.accentColor);
  const safeSoft = escapeHtml(theme.softColor);
  const safeSymbol = escapeHtml(theme.symbol);
  return `
    <svg width="560" height="220" viewBox="0 0 560 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ilustracao de vela">
      <rect x="0" y="0" width="560" height="220" rx="22" fill="${safeSoft}" />
      <rect x="30" y="160" width="500" height="28" rx="14" fill="#F2E8DA" />
      <ellipse cx="280" cy="74" rx="21" ry="29" fill="#F8B15A" />
      <path d="M280 37C291 53 291 64 280 72C269 64 269 53 280 37Z" fill="#FFD89A" />
      <rect x="235" y="88" width="90" height="90" rx="24" fill="#FFFFFF" stroke="#DCCBB4" stroke-width="4" />
      <rect x="250" y="108" width="60" height="44" rx="14" fill="#F8EFE2" />
      <rect x="277" y="80" width="6" height="16" rx="3" fill="#8F5D2F" />
      <circle cx="430" cy="68" r="36" fill="${safeAccent}" opacity="0.16" />
      <circle cx="430" cy="68" r="30" fill="${safeAccent}" />
      <text x="430" y="73" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF">${safeSymbol}</text>
      <text x="430" y="110" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="11" fill="#6B5E4E">EncantArtes</text>
      <text x="130" y="110" text-anchor="middle" font-family="Verdana, Arial, sans-serif" font-size="11" fill="#8A7B6A">Velas artesanais</text>
    </svg>
  `;
}

function subjectForAudience(order: Order, audience: EmailAudience): string {
  const stage = getStage(order);
  const theme = stageTheme(stage);
  const prefix = audience === "admin" ? theme.adminSubject : theme.customerSubject;
  return `${prefix} - ${order.id}`;
}

function headlineForAudience(order: Order, audience: EmailAudience): string {
  const stage = getStage(order);
  const theme = stageTheme(stage);
  return audience === "admin" ? theme.adminHeadline : theme.customerHeadline;
}

function finalStatusLabel(order: Order): string {
  const theme = stageTheme(getStage(order));
  return `${theme.statusLabel} (${paymentStatusLabel(order.paymentStatus)})`;
}

function badgeLabel(order: Order): string {
  return stageTheme(getStage(order)).badgeLabel;
}

export function customerOrderEmailSubject(order: Order): string {
  return subjectForAudience(order, "customer");
}

export function adminOrderEmailSubject(order: Order): string {
  return subjectForAudience(order, "admin");
}

export function buildOrderEmail(
  order: Order,
  audience: EmailAudience = "customer"
): { subject: string; html: string; text: string } {
  const itemsHtml = order.items
    .map((item) => {
      const extras = [
        item.variant ? `Cor: ${escapeHtml(item.variant)}` : "",
        item.fragrance ? `Fragrancia: ${escapeHtml(item.fragrance)}` : ""
      ]
        .filter(Boolean)
        .join(" | ");
      return `<li><strong>${escapeHtml(item.name)}</strong> x${item.quantity} - ${formatCurrency(item.price * item.quantity)}${
        extras ? ` <br/><small>${extras}</small>` : ""
      }</li>`;
    })
    .join("");

  const stage = getStage(order);
  const theme = stageTheme(stage);
  const status = finalStatusLabel(order);
  const address = escapeHtml(
    `${order.address.street}, ${order.address.number} - ${order.address.neighborhood}, ${order.address.city}/${order.address.state}, CEP ${order.address.cep}`
  );
  const safeCustomerName = escapeHtml(order.customerName);
  const safeCustomerEmail = escapeHtml(order.customerEmail);
  const safeCustomerPhone = order.customerPhone ? escapeHtml(order.customerPhone) : "";
  const safePaymentMethod = escapeHtml(paymentMethodLabel(order.paymentMethod));
  const safeNotes = order.notes ? escapeHtml(order.notes) : "";
  const safeCouponCode = order.couponCode ? escapeHtml(order.couponCode) : "";
  const safeHeadline = escapeHtml(headlineForAudience(order, audience));
  const hasDiscount = typeof order.discountAmount === "number" && order.discountAmount > 0;
  const safeStatus = escapeHtml(status);
  const safeBadge = escapeHtml(theme.badgeLabel);
  const safeAccent = escapeHtml(theme.accentColor);
  const safeSoft = escapeHtml(theme.softColor);
  const safeOrderShort = escapeHtml(buildOrderLabel(order.id));
  const safeTrackingCode = order.trackingCode ? escapeHtml(order.trackingCode) : "";
  const safeTrackingUrl = order.trackingUrl ? escapeHtml(order.trackingUrl) : "";
  const safeRoleLabel = audience === "admin" ? "Painel da loja" : "Atualizacao de compra";
  const brandLogo = buildBrandLogoSvg();
  const illustration = buildCandleIllustration(theme);
  const safeInstagram = escapeHtml(BRAND_INSTAGRAM);
  const safePhone = escapeHtml(BRAND_PHONE);

  return {
    subject: audience === "admin" ? adminOrderEmailSubject(order) : customerOrderEmailSubject(order),
    html: `
      <div style="margin:0;padding:26px;background:#F3ECE3;font-family:Verdana,Arial,sans-serif;color:#2A241E;">
        <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E6D9C8;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(34,25,16,0.08);">
          <div style="padding:18px 22px;background:#FFFFFF;border-bottom:1px solid #EFE4D6;text-align:center;">
            ${brandLogo}
          </div>

          <div style="padding:18px 22px;border-bottom:1px solid #EFE4D6;background:${safeSoft};">
            <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7B6853;">${safeRoleLabel}</p>
            <h2 style="margin:6px 0 0 0;font-size:25px;line-height:1.2;color:#1F1A15;">Pedido #${safeOrderShort}</h2>
            <p style="margin:8px 0 0 0;font-size:14px;color:#5F5144;">${safeHeadline}</p>
            <div style="margin-top:10px;display:inline-block;padding:6px 12px;border-radius:999px;background:${safeAccent};color:#FFFFFF;font-weight:700;font-size:11px;letter-spacing:0.06em;">${safeBadge}</div>
          </div>

          <div style="padding:18px 22px 0 22px;">
            ${illustration}
          </div>

          <div style="padding:18px 22px 22px 22px;">
            <p style="margin:0 0 10px 0;font-size:14px;"><strong>Status:</strong> ${safeStatus}</p>
            <p style="margin:0 0 6px 0;font-size:14px;"><strong>Cliente:</strong> ${safeCustomerName} (${safeCustomerEmail})</p>
            ${safeCustomerPhone ? `<p style="margin:0 0 6px 0;font-size:14px;"><strong>Telefone:</strong> ${safeCustomerPhone}</p>` : ""}
            <p style="margin:0 0 6px 0;font-size:14px;"><strong>Endereco:</strong> ${address}</p>
            <p style="margin:0 0 10px 0;font-size:14px;"><strong>Pagamento:</strong> ${safePaymentMethod}</p>
            ${safeTrackingCode ? `<p style="margin:0 0 6px 0;font-size:14px;"><strong>Rastreio:</strong> ${safeTrackingCode}</p>` : ""}
            ${safeTrackingUrl ? `<p style="margin:0 0 10px 0;font-size:14px;"><strong>Link de rastreio:</strong> <a href="${safeTrackingUrl}" target="_blank" rel="noreferrer">${safeTrackingUrl}</a></p>` : ""}
            ${safeNotes ? `<p style="margin:0 0 12px 0;font-size:14px;"><strong>Observacoes:</strong> ${safeNotes}</p>` : ""}

            <div style="margin-top:12px;padding:14px;border:1px solid #E9DDCE;border-radius:16px;background:#FFFDFC;">
              <p style="margin:0 0 8px 0;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#7B6853;">Itens do pedido</p>
              <ul style="margin:0 0 0 18px;padding:0;font-size:14px;line-height:1.5;">${itemsHtml}</ul>
            </div>

            <div style="margin-top:12px;padding:14px;border:1px solid #E9DDCE;border-radius:16px;background:#FFFDFC;">
              <p style="margin:0;font-size:14px;"><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
              ${hasDiscount ? `<p style="margin:6px 0 0 0;font-size:14px;"><strong>Cupom:</strong> ${safeCouponCode} (-${formatCurrency(order.discountAmount || 0)})</p>` : ""}
              <p style="margin:6px 0 0 0;font-size:14px;"><strong>Frete:</strong> ${formatCurrency(order.shippingAmount)}</p>
              <p style="margin:6px 0 0 0;font-size:16px;color:${safeAccent};"><strong>Total:</strong> ${formatCurrency(order.total)}</p>
            </div>

            <div style="margin-top:14px;border-top:1px solid #EFE4D6;padding-top:12px;font-size:12px;color:#74614D;">
              <p style="margin:0;">EncantArtes · Velas artesanais e presentes</p>
              <p style="margin:6px 0 0 0;">Instagram: ${safeInstagram} · WhatsApp: ${safePhone}</p>
            </div>
          </div>
        </div>
      </div>
    `,
    text: [
      `${audience === "admin" ? "Painel da loja" : "Atualizacao de compra"}`,
      `Pedido ${order.id}`,
      `Status: ${status}`,
      headlineForAudience(order, audience),
      `Cliente: ${order.customerName} (${order.customerEmail})`,
      ...(order.customerPhone ? [`Telefone: ${order.customerPhone}`] : []),
      `Endereco: ${address}`,
      `Pagamento: ${paymentMethodLabel(order.paymentMethod)}`,
      `Badge: ${badgeLabel(order)}`,
      ...(order.trackingCode ? [`Rastreio: ${order.trackingCode}`] : []),
      ...(order.trackingUrl ? [`Link rastreio: ${order.trackingUrl}`] : []),
      ...(order.notes ? [`Observacoes: ${order.notes}`] : []),
      ...order.items.map((item) => {
        const extras = [item.variant ? `Cor: ${item.variant}` : "", item.fragrance ? `Fragrancia: ${item.fragrance}` : ""]
          .filter(Boolean)
          .join(" | ");
        return `- ${item.name} x${item.quantity} (${formatCurrency(item.price * item.quantity)})${extras ? ` [${extras}]` : ""}`;
      }),
      `Subtotal: ${formatCurrency(order.subtotal)}`,
      ...(hasDiscount ? [`Cupom: ${order.couponCode} (-${formatCurrency(order.discountAmount || 0)})`] : []),
      `Frete: ${formatCurrency(order.shippingAmount)}`,
      `Total: ${formatCurrency(order.total)}`,
      `Contato: Instagram ${BRAND_INSTAGRAM} | WhatsApp ${BRAND_PHONE}`
    ].join("\n")
  };
}
