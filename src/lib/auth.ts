import {
  ADMIN_PASSWORD_FALLBACK,
  ADMIN_SESSION_KEY,
  ADMIN_SESSION_TTL_MS
} from "@/lib/config";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";

type AdminSession = {
  token: string;
  expiresAt: number;
};

export function getAdminPassword(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD || ADMIN_PASSWORD_FALLBACK;
}

export function isUsingDefaultPassword(): boolean {
  return !import.meta.env.VITE_ADMIN_PASSWORD;
}

export function createSession(): AdminSession {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const session: AdminSession = {
    token,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
  };
  writeStorage(ADMIN_SESSION_KEY, session);
  return session;
}

export function getSession(): AdminSession | null {
  return readStorage<AdminSession | null>(ADMIN_SESSION_KEY, null);
}

export function clearSession(): void {
  removeStorage(ADMIN_SESSION_KEY);
}

export function isSessionValid(): boolean {
  const session = getSession();
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    clearSession();
    return false;
  }
  return true;
}

export function loginWithPassword(password: string): boolean {
  if (password !== getAdminPassword()) return false;
  createSession();
  return true;
}



