import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatPhoneBR(value: string): string {
  const digits = onlyDigits(value);
  const digitsNoCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  if (!digitsNoCountry) return "";
  const ddd = digitsNoCountry.slice(0, 2);
  const rest = digitsNoCountry.slice(2);
  if (!rest) return `+55 ${ddd}`;
  const first = rest.length > 8 ? rest.slice(0, 5) : rest.slice(0, 4);
  const last = rest.slice(first.length, first.length + 4);
  const separator = last ? `-${last}` : "";
  return `+55 ${ddd} ${first}${separator}`;
}

export function clampText(value: string, max = 140): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}



