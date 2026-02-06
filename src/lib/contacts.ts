import { CONTACTS_STORAGE_KEY, DEFAULT_CONTACTS } from "@/lib/config";
import { readStorage, writeStorage } from "@/lib/storage";
import { onlyDigits } from "@/lib/utils";

export type Contacts = {
  whatsapp: string;
  instagram: string;
};

export function normalizeInstagram(handle: string): string {
  return handle.replace(/^@/, "").trim();
}

export function normalizeWhatsapp(value: string): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function getContacts(): Contacts {
  return readStorage(CONTACTS_STORAGE_KEY, DEFAULT_CONTACTS);
}

export function setContacts(data: Contacts): void {
  writeStorage(CONTACTS_STORAGE_KEY, data);
}


