import { put, del } from "@vercel/blob";
import { Redis } from "@upstash/redis";
import { readFileSync } from "node:fs";
import type { Product, ProductInput } from "../src/types/product";

type ProductSort = "featured" | "newest" | "price-asc" | "price-desc";

type ProductListParams = {
  search?: string;
  category?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  featured?: boolean;
  weeklyCurated?: boolean;
};

type ProductListResult = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

const seedProducts = JSON.parse(
  readFileSync(new URL("../src/data/seedProducts.json", import.meta.url), "utf8")
) as Product[];

const PRODUCTS_KEY = "encantartes_products";
const DEFAULT_PAGE_SIZE = 8;

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

function getRedis(): Redis {
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

function json(res: any, status: number, body: unknown) {
  if (status === 204) {
    res.status(status).end();
    return;
  }
  res.status(status).json(body);
}

function getQueryParam(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cloneProduct(product: Product): Product {
  return {
    ...product,
    images: [...product.images],
    variants: product.variants ? [...product.variants] : undefined
  };
}

function normalizeVariants(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const next = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  return next.length ? next : undefined;
}

function cloneProducts(products: Product[]): Product[] {
  return products.map(cloneProduct);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function applySearch(products: Product[], search?: string): Product[] {
  if (!search) return products;
  const query = search.trim().toLowerCase();
  if (!query) return products;
  return products.filter((product) => {
    return (
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query)
    );
  });
}

function applySort(products: Product[], sort?: ProductSort): Product[] {
  const items = [...products];
  switch (sort) {
    case "price-asc":
      return items.sort((a, b) => a.price - b.price);
    case "price-desc":
      return items.sort((a, b) => b.price - a.price);
    case "newest":
      return items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "featured":
    default:
      return items.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

async function readProducts(): Promise<Product[]> {
  const redis = getRedis();
  const raw = await redis.get<string | Product[]>(PRODUCTS_KEY);
  if (!raw) {
    return cloneProducts(seedProducts as Product[]);
  }

  // Upstash SDK may auto-deserialize JSON strings and return arrays directly.
  if (Array.isArray(raw)) {
    return cloneProducts(raw as Product[]);
  }

  if (typeof raw !== "string") {
    return cloneProducts(seedProducts as Product[]);
  }

  try {
    const parsed = JSON.parse(raw) as Product[];
    if (!Array.isArray(parsed)) {
      return cloneProducts(seedProducts as Product[]);
    }
    return cloneProducts(parsed);
  } catch {
    return cloneProducts(seedProducts as Product[]);
  }
}

async function saveProducts(products: Product[]): Promise<void> {
  const redis = getRedis();
  const value = JSON.stringify(products);
  await redis.set(PRODUCTS_KEY, value);
}

function parseDataUrl(value: string): { mime: string; buffer: Buffer } {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Imagem em formato inválido.");
  const mime = match[1];
  const base64 = match[2];
  return {
    mime,
    buffer: Buffer.from(base64, "base64")
  };
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("vercel-storage.com");
  } catch {
    return false;
  }
}

async function deleteBlobUrls(urls: string[]): Promise<void> {
  const blobUrls = urls.filter(isBlobUrl);
  if (!blobUrls.length) return;
  try {
    await del(blobUrls);
  } catch {
    // Best-effort cleanup to avoid blocking CRUD if Blob delete fails.
  }
}

async function resolveImageUrls(productId: string, images: string[]): Promise<string[]> {
  const resolved: string[] = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    if (!image.startsWith("data:image")) {
      resolved.push(image);
      continue;
    }

    const { mime, buffer } = parseDataUrl(image);
    const ext = extensionFromMime(mime);
    const blob = await put(
      `products/${productId}/${Date.now()}-${index}.${ext}`,
      buffer,
      {
        access: "public",
        addRandomSuffix: true,
        contentType: mime
      }
    );
    resolved.push(blob.url);
  }

  return resolved;
}

function validateProductInput(value: unknown): asserts value is ProductInput {
  if (!value || typeof value !== "object") {
    throw new Error("Corpo da requisição inválido.");
  }

  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || input.name.trim().length < 2) {
    throw new Error("Nome do produto inválido.");
  }
  if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Preço inválido.");
  }
  if (typeof input.description !== "string" || input.description.trim().length < 10) {
    throw new Error("Descrição inválida.");
  }
  if (typeof input.category !== "string" || input.category.trim().length < 2) {
    throw new Error("Categoria inválida.");
  }
  if (!Array.isArray(input.images) || input.images.length < 1 || input.images.length > 3) {
    throw new Error("Inclua entre 1 e 3 imagens.");
  }
  if (!input.images.every((item) => typeof item === "string" && item.length >= 5)) {
    throw new Error("Lista de imagens inválida.");
  }
  if (input.variants !== undefined) {
    if (!Array.isArray(input.variants)) {
      throw new Error("Campo 'variants' inválido.");
    }
    if (input.variants.length > 12) {
      throw new Error("Inclua no máximo 12 variações.");
    }
    if (
      !input.variants.every(
        (item) => typeof item === "string" && item.trim().length >= 1 && item.trim().length <= 40
      )
    ) {
      throw new Error("Lista de variações inválida.");
    }
  }
  if (typeof input.featured !== "boolean") {
    throw new Error("Campo 'featured' inválido.");
  }
  if (input.weeklyCurated !== undefined && typeof input.weeklyCurated !== "boolean") {
    throw new Error("Campo 'weeklyCurated' inválido.");
  }
  if (typeof input.inStock !== "boolean") {
    throw new Error("Campo 'inStock' inválido.");
  }
}

function getAdminPasswordFromEnv(): string {
  return process.env.VITE_ADMIN_PASSWORD || "encantartes123";
}

function readHeader(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function assertAdminAccess(req: any): void {
  const headerPassword = readHeader(req.headers?.["x-admin-password"]);
  if (!headerPassword || headerPassword !== getAdminPasswordFromEnv()) {
    throw new Error("Não autorizado.");
  }
}

async function readJsonBody(req: any): Promise<unknown> {
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

function buildList(products: Product[], params: ProductListParams = {}): ProductListResult {
  const {
    search,
    category,
    featured,
    weeklyCurated,
    sort = "featured",
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE
  } = params;

  let filtered = products;

  if (featured) {
    filtered = filtered.filter((product) => product.featured);
  }

  if (weeklyCurated !== undefined) {
    filtered = filtered.filter((product) => Boolean(product.weeklyCurated) === weeklyCurated);
  }

  if (category && category !== "all") {
    filtered = filtered.filter(
      (product) => product.category.toLowerCase() === category.toLowerCase()
    );
  }

  filtered = applySearch(filtered, search);
  filtered = applySort(filtered, sort);

  const total = filtered.length;
  const start = page * pageSize;
  const items = filtered.slice(start, start + pageSize).map(cloneProduct);

  return { items, total, page, pageSize };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const mode = getQueryParam(req.query?.mode);
      const id = getQueryParam(req.query?.id);
      const slug = getQueryParam(req.query?.slug);
      const products = await readProducts();

      if (mode === "categories") {
        const categories = Array.from(new Set(products.map((product) => product.category))).sort();
        return json(res, 200, categories);
      }

      if (mode === "item" || id || slug) {
        const found = id
          ? products.find((product) => product.id === id)
          : products.find((product) => product.slug === slug);
        return json(res, 200, found ? cloneProduct(found) : null);
      }

      if (mode === "all") {
        return json(res, 200, cloneProducts(products));
      }

      const list = buildList(products, {
        search: getQueryParam(req.query?.search),
        category: getQueryParam(req.query?.category),
        sort: (getQueryParam(req.query?.sort) as ProductSort | undefined) ?? "featured",
        featured: parseBoolean(getQueryParam(req.query?.featured)),
        weeklyCurated: parseBoolean(getQueryParam(req.query?.weeklyCurated)),
        page: parseNumber(getQueryParam(req.query?.page), 0),
        pageSize: parseNumber(getQueryParam(req.query?.pageSize), DEFAULT_PAGE_SIZE)
      });
      return json(res, 200, list);
    }

    if (req.method === "POST") {
      assertAdminAccess(req);
      const body = await readJsonBody(req);
      validateProductInput(body);

      const input = body as ProductInput;
      const products = await readProducts();
      const now = new Date().toISOString();
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const images = await resolveImageUrls(id, input.images);
      const variants = normalizeVariants(input.variants);
      const product: Product = {
        ...input,
        id,
        images,
        variants,
        slug: input.slug?.trim() || slugify(input.name),
        createdAt: now,
        updatedAt: now
      };

      await saveProducts([product, ...products]);
      return json(res, 201, cloneProduct(product));
    }

    if (req.method === "PUT") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parâmetro 'id' é obrigatório." });
      }

      const body = await readJsonBody(req);
      validateProductInput(body);
      const input = body as ProductInput;
      const products = await readProducts();
      const existing = products.find((product) => product.id === id);
      if (!existing) {
        return json(res, 404, { error: "Produto não encontrado." });
      }

      const images = await resolveImageUrls(id, input.images);
      const variants = normalizeVariants(input.variants);
      const now = new Date().toISOString();
      const updatedProduct: Product = {
        ...existing,
        ...input,
        images,
        variants,
        slug: input.slug?.trim() || slugify(input.name),
        updatedAt: now
      };

      const nextProducts = products.map((product) => (product.id === id ? updatedProduct : product));
      await saveProducts(nextProducts);

      const removedBlobUrls = existing.images.filter(
        (url) => !updatedProduct.images.includes(url) && isBlobUrl(url)
      );
      await deleteBlobUrls(removedBlobUrls);

      return json(res, 200, cloneProduct(updatedProduct));
    }

    if (req.method === "DELETE") {
      assertAdminAccess(req);
      const id = getQueryParam(req.query?.id);
      if (!id) {
        return json(res, 400, { error: "Parâmetro 'id' é obrigatório." });
      }

      const products = await readProducts();
      const existing = products.find((product) => product.id === id);
      if (!existing) {
        return json(res, 204, null);
      }

      await saveProducts(products.filter((product) => product.id !== id));
      await deleteBlobUrls(existing.images);
      return json(res, 204, null);
    }

    res.setHeader("Allow", "GET,POST,PUT,DELETE");
    return json(res, 405, { error: "Método não permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message === "Não autorizado." ? 401 : 500;
    return json(res, status, { error: message });
  }
}
