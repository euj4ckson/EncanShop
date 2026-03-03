import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

type EmailConfig = {
  resend: {
    apiKey: string;
    from: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    secure: boolean;
    rejectUnauthorized: boolean;
  };
  adminTo: string;
};

type SendAttempt = {
  ok: boolean;
  provider: "resend" | "smtp";
  error?: string;
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

let smtpTransporter: nodemailer.Transporter | null = null;
let smtpTransportKey = "";

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseBoolean(value: string, fallback: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
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

function getEmailConfig(): EmailConfig {
  const resendFrom = firstEnv(
    "ORDER_EMAIL_FROM",
    "RESEND_FROM_EMAIL",
    "RESEND_FROM",
    "VITE_ORDER_EMAIL_FROM",
    "VITE_RESEND_FROM_EMAIL"
  );
  const smtpPortRaw = firstEnv("SMTP_PORT", "GMAIL_SMTP_PORT");
  const smtpPort = Number(smtpPortRaw || "465");
  const normalizedSmtpPort = Number.isFinite(smtpPort) && smtpPort > 0 ? smtpPort : 465;
  const smtpSecureDefault = normalizedSmtpPort === 465;
  const smtpSecure = parseBoolean(firstEnv("SMTP_SECURE", "GMAIL_SMTP_SECURE"), smtpSecureDefault);
  const rejectUnauthorized = parseBoolean(
    firstEnv("SMTP_TLS_REJECT_UNAUTHORIZED"),
    true
  );

  return {
    resend: {
      apiKey: firstEnv("RESEND_API_KEY", "VITE_RESEND_API_KEY"),
      from: resendFrom
    },
    smtp: {
      host: firstEnv("SMTP_HOST", "GMAIL_SMTP_HOST") || "smtp.gmail.com",
      port: normalizedSmtpPort,
      user: firstEnv("SMTP_USER", "GMAIL_USER"),
      pass: firstEnv("SMTP_PASS", "GMAIL_APP_PASSWORD"),
      from: firstEnv("SMTP_FROM", "GMAIL_FROM_EMAIL") || resendFrom,
      secure: smtpSecure,
      rejectUnauthorized
    },
    adminTo: firstEnv("ORDER_ADMIN_EMAIL", "ADMIN_EMAIL", "VITE_ORDER_ADMIN_EMAIL") || "jacksonduardo6@gmail.com"
  };
}

function normalizeRecipients(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((value) => value.trim()).filter(Boolean);
}

function hasResendConfig(config: EmailConfig): boolean {
  return Boolean(config.resend.apiKey && config.resend.from);
}

function hasSmtpConfig(config: EmailConfig): boolean {
  const smtp = config.smtp;
  return Boolean(smtp.host && smtp.port && smtp.user && smtp.pass && smtp.from);
}

function isSharedProviderFromAddress(from: string): boolean {
  const domain = getEmailDomain(from);
  return SHARED_EMAIL_DOMAINS.has(domain);
}

async function sendViaResend(input: {
  config: EmailConfig;
  recipients: string[];
  payload: SendEmailInput;
}): Promise<SendAttempt> {
  const { config, recipients, payload } = input;
  const { apiKey, from } = config.resend;
  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "resend",
      error: "config-missing"
    };
  }

  if (isSharedProviderFromAddress(from)) {
    return {
      ok: false,
      provider: "resend",
      error: `from-domain-not-accepted:${getEmailDomain(from)}`
    };
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
          subject: payload.subject,
          html: payload.html,
          text: payload.text
        })
      });

      if (response.ok) {
        return {
          ok: true,
          provider: "resend"
        };
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
        `[email] Falha no envio via Resend (${response.status}). Subject="${payload.subject}" To="${recipients.join(", ")}" Body=${details}`
      );
      return {
        ok: false,
        provider: "resend",
        error: `http-${response.status}`
      };
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
      console.error(`[email] Erro de rede no envio via Resend: ${message}`);
      return {
        ok: false,
        provider: "resend",
        error: message
      };
    }
  }

  return {
    ok: false,
    provider: "resend",
    error: "exhausted-retries"
  };
}

function buildSmtpTransportKey(config: EmailConfig): string {
  const smtp = config.smtp;
  return [
    smtp.host,
    smtp.port,
    smtp.user,
    smtp.secure ? "1" : "0",
    smtp.rejectUnauthorized ? "1" : "0"
  ].join("|");
}

function getSmtpTransporter(config: EmailConfig): nodemailer.Transporter {
  const nextKey = buildSmtpTransportKey(config);
  if (smtpTransporter && smtpTransportKey === nextKey) {
    return smtpTransporter;
  }
  smtpTransporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    },
    tls: {
      rejectUnauthorized: config.smtp.rejectUnauthorized
    }
  });
  smtpTransportKey = nextKey;
  return smtpTransporter;
}

async function sendViaSmtp(input: {
  config: EmailConfig;
  recipients: string[];
  payload: SendEmailInput;
}): Promise<SendAttempt> {
  const { config, recipients, payload } = input;
  if (!hasSmtpConfig(config)) {
    return {
      ok: false,
      provider: "smtp",
      error: "config-missing"
    };
  }

  try {
    const transporter = getSmtpTransporter(config);
    await transporter.sendMail({
      from: config.smtp.from,
      to: recipients.join(", "),
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    });
    return {
      ok: true,
      provider: "smtp"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[email] Falha no envio via SMTP. Subject="${payload.subject}" To="${recipients.join(", ")}" Error=${message}`
    );
    return {
      ok: false,
      provider: "smtp",
      error: message
    };
  }
}

export async function sendEmail(payload: SendEmailInput): Promise<boolean> {
  const config = getEmailConfig();
  const recipients = normalizeRecipients(payload.to);
  if (!recipients.length) {
    console.error("[email] Nenhum destinatario valido informado.");
    return false;
  }

  let resendAttempt: SendAttempt | null = null;
  if (hasResendConfig(config)) {
    resendAttempt = await sendViaResend({
      config,
      recipients,
      payload
    });
    if (resendAttempt.ok) return true;

    console.warn(
      `[email] Resend indisponivel (${resendAttempt.error || "erro desconhecido"}). Tentando SMTP fallback.`
    );
  }

  if (hasSmtpConfig(config)) {
    const smtpAttempt = await sendViaSmtp({
      config,
      recipients,
      payload
    });
    if (smtpAttempt.ok) return true;
  }

  if (!hasResendConfig(config) && !hasSmtpConfig(config)) {
    console.error(
      "[email] Configuracao incompleta. Configure Resend (RESEND_API_KEY + ORDER_EMAIL_FROM) ou SMTP (SMTP_HOST/PORT/USER/PASS/FROM)."
    );
  }

  return false;
}

export function getAdminEmail(): string {
  return getEmailConfig().adminTo;
}

