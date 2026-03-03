type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

const RATE_LIMIT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 800;
const SHARED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com"
]);

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractEmailAddress(value: string): string {
  const bracketMatch = value.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase();
  return value.trim().toLowerCase();
}

function getEmailDomain(value: string): string {
  const email = extractEmailAddress(value);
  const [, domain = ""] = email.split("@");
  return domain;
}

function parseRetryDelayMs(value: string | null, attempt: number): number {
  if (value) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
      return Math.max(200, Math.round(asNumber * 1000));
    }
    const asDate = Date.parse(value);
    if (Number.isFinite(asDate)) {
      const delta = asDate - Date.now();
      if (delta > 0) return delta;
    }
  }
  return DEFAULT_RETRY_DELAY_MS * attempt;
}

function getEmailConfig() {
  return {
    apiKey: firstEnv("RESEND_API_KEY", "VITE_RESEND_API_KEY"),
    from: firstEnv(
      "ORDER_EMAIL_FROM",
      "RESEND_FROM_EMAIL",
      "RESEND_FROM",
      "VITE_ORDER_EMAIL_FROM",
      "VITE_RESEND_FROM_EMAIL"
    ),
    adminTo: firstEnv("ORDER_ADMIN_EMAIL", "ADMIN_EMAIL", "VITE_ORDER_ADMIN_EMAIL") || "jacksonduardo6@gmail.com"
  };
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    console.error(
      "[email] Configuracao incompleta. Defina RESEND_API_KEY e ORDER_EMAIL_FROM (ou aliases suportados)."
    );
    return false;
  }

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((value) => value.trim())
    .filter(Boolean);
  if (!recipients.length) {
    console.error("[email] Nenhum destinatario valido informado.");
    return false;
  }

  const fromDomain = getEmailDomain(from);
  if (SHARED_EMAIL_DOMAINS.has(fromDomain)) {
    console.error(
      `[email] Remetente invalido para Resend: "${from}". Use um dominio proprio verificado (ex: pedidos@seudominio.com).`
    );
    return false;
  }

  for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: input.subject,
          html: input.html,
          text: input.text
        })
      });

      if (response.ok) {
        return true;
      }

      const details = await response.text();
      if (response.status === 429 && attempt < RATE_LIMIT_MAX_ATTEMPTS) {
        const retryMs = parseRetryDelayMs(response.headers.get("retry-after"), attempt);
        console.warn(
          `[email] Rate limit no Resend (429). Retry em ${retryMs}ms. Tentativa ${attempt}/${RATE_LIMIT_MAX_ATTEMPTS}.`
        );
        await sleep(retryMs);
        continue;
      }

      console.error(
        `[email] Falha no envio (${response.status}). Subject="${input.subject}" To="${recipients.join(", ")}" Body=${details}`
      );
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < RATE_LIMIT_MAX_ATTEMPTS) {
        const retryMs = DEFAULT_RETRY_DELAY_MS * attempt;
        console.warn(
          `[email] Erro de rede no envio. Retry em ${retryMs}ms. Tentativa ${attempt}/${RATE_LIMIT_MAX_ATTEMPTS}. Motivo: ${message}`
        );
        await sleep(retryMs);
        continue;
      }
      console.error(`[email] Erro de rede no envio: ${message}`);
      return false;
    }
  }

  return false;
}

export function getAdminEmail(): string {
  return getEmailConfig().adminTo;
}

