type MaybeArray<T> = T | T[];

export function json(res: any, status: number, body: unknown) {
  if (status === 204) {
    res.status(status).end();
    return;
  }
  res.status(status).json(body);
}

export function readHeader(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

export function getQueryParam(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

export function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCep(value: string): string {
  return onlyDigits(value).slice(0, 8);
}

export async function readJsonBody(req: any): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === "string" && req.body) {
      return JSON.parse(req.body);
    }
    return req.body;
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function readBearerToken(req: any): string | null {
  const auth = readHeader(req.headers?.authorization);
  if (!auth) return null;
  const [type, token] = auth.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export function pickFirstString(value: MaybeArray<string | undefined> | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.find((item) => typeof item === "string") || "";
  return value;
}

