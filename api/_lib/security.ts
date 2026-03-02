import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

type CustomerTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(padLen)}`, "base64").toString("utf8");
}

function signTokenPart(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function getAuthSecret(): string {
  const secret = process.env.CUSTOMER_AUTH_SECRET || "";
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Configuracao ausente: defina CUSTOMER_AUTH_SECRET.");
  }
  return "encantartes_customer_dev_secret";
}

export function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;

  const computed = scryptSync(password, salt, 64).toString("hex");
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(computed, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function createCustomerToken(data: { customerId: string; email: string }): string {
  const payload: CustomerTokenPayload = {
    sub: data.customerId,
    email: data.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const signature = signTokenPart(unsigned, getAuthSecret());
  return `${unsigned}.${signature}`;
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = signTokenPart(`${headerPart}.${payloadPart}`, getAuthSecret());
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signaturePart);
  if (expectedBuffer.length !== receivedBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart)) as CustomerTokenPayload;
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function splitFullName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "Cliente", lastName: "EncantArtes" };
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift() || "Cliente";
  const lastName = parts.join(" ") || "EncantArtes";
  return { firstName, lastName };
}
