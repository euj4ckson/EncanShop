import { CUSTOMER_TOKEN_KEY } from "@/lib/config";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";

type TokenState = {
  token: string;
};

export function getCustomerToken(): string {
  const state = readStorage<TokenState | null>(CUSTOMER_TOKEN_KEY, null);
  return state?.token || "";
}

export function setCustomerToken(token: string): void {
  writeStorage<TokenState>(CUSTOMER_TOKEN_KEY, { token });
}

export function clearCustomerToken(): void {
  removeStorage(CUSTOMER_TOKEN_KEY);
}

export function isCustomerAuthed(): boolean {
  return Boolean(getCustomerToken());
}

