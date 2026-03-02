import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

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

