import { Redis } from "@upstash/redis";
import { randomBytes } from "node:crypto";

let redisClient: Redis | null = null;
const LOCK_PREFIX = "encantartes_lock";
const DEFAULT_LOCK_TTL_SECONDS = 12;
const DEFAULT_LOCK_WAIT_MS = 80;
const DEFAULT_LOCK_MAX_ATTEMPTS = 80;

function getRedisEnv():
  | {
      url: string;
      token: string;
    }
  | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export function getRedis(): Redis {
  if (redisClient) return redisClient;
  const env = getRedisEnv();
  if (!env) {
    throw new Error(
      "Configuracao ausente: defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel."
    );
  }
  redisClient = new Redis(env);
  return redisClient;
}

export async function readJsonValue<T>(key: string, fallback: T): Promise<T> {
  const redis = getRedis();
  const raw = await redis.get<unknown>(key);
  if (!raw) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

export async function writeJsonValue<T>(key: string, value: T): Promise<void> {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockToken(): string {
  return randomBytes(12).toString("hex");
}

export async function withRedisLock<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    ttlSeconds?: number;
    waitMs?: number;
    maxAttempts?: number;
  }
): Promise<T> {
  const redis = getRedis();
  const ttlSeconds = Math.max(3, options?.ttlSeconds ?? DEFAULT_LOCK_TTL_SECONDS);
  const waitMs = Math.max(20, options?.waitMs ?? DEFAULT_LOCK_WAIT_MS);
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_LOCK_MAX_ATTEMPTS);
  const key = `${LOCK_PREFIX}:${name}`;
  const token = lockToken();
  let acquired = false;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await redis.set<string>(key, token, {
      nx: true,
      ex: ttlSeconds
    });
    if (result === "OK") {
      acquired = true;
      break;
    }
    await sleep(waitMs);
  }

  if (!acquired) {
    throw new Error(`Falha ao adquirir lock de concorrencia (${name}).`);
  }

  try {
    return await fn();
  } finally {
    try {
      const owner = await redis.get<string>(key);
      if (owner === token) {
        await redis.del(key);
      }
    } catch {
      // Ignore unlock failures; TTL guarantees eventual release.
    }
  }
}

