type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
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

    if (!response.ok) {
      const details = await response.text();
      console.error(
        `[email] Falha no envio (${response.status}). Subject="${input.subject}" To="${recipients.join(", ")}" Body=${details}`
      );
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email] Erro de rede no envio: ${message}`);
    return false;
  }
}

export function getAdminEmail(): string {
  return getEmailConfig().adminTo;
}

