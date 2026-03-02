type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.ORDER_EMAIL_FROM || "",
    adminTo: process.env.ORDER_ADMIN_EMAIL || "jacksonduardo6@gmail.com"
  };
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  return response.ok;
}

export function getAdminEmail(): string {
  return getEmailConfig().adminTo;
}

