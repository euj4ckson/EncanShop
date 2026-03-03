import { readFileSync } from "node:fs";
import type { Product } from "../../src/types/product";
import { readJsonValue } from "./redis.js";

const PRODUCTS_KEY = "encantartes_products";
const seedProducts = JSON.parse(
  readFileSync(new URL("../../src/data/seedProducts.json", import.meta.url), "utf8")
) as Product[];

function cloneProduct(product: Product): Product {
  return {
    ...product,
    images: Array.isArray(product.images) ? [...product.images] : [],
    variants: Array.isArray(product.variants) ? [...product.variants] : undefined
  };
}

function cloneProducts(products: Product[]): Product[] {
  return products.map(cloneProduct);
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const product = value as Partial<Product>;
  return (
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    product.price > 0 &&
    typeof product.slug === "string" &&
    typeof product.description === "string" &&
    typeof product.category === "string" &&
    Array.isArray(product.images)
  );
}

export async function readProductsCatalog(): Promise<Product[]> {
  const fallback = cloneProducts(seedProducts);
  const raw = await readJsonValue<unknown>(PRODUCTS_KEY, fallback);
  if (!Array.isArray(raw)) return fallback;
  const parsed = raw.filter(isProduct).map(cloneProduct);
  return parsed.length ? parsed : fallback;
}
