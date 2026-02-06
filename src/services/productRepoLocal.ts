import seedProducts from "@/data/seedProducts.json";
import { PAGE_SIZE } from "@/lib/config";
import { slugify } from "@/lib/utils";
import type { Product, ProductInput } from "@/types/product";
import type { ProductListParams, ProductListResult, ProductRepo } from "@/services/productRepo";

let runtimeProducts: Product[] | null = null;

function ensureSeed(): Product[] {
  if (!runtimeProducts) {
    runtimeProducts = (seedProducts as Product[]).map((product) => ({
      ...product,
      images: [...product.images]
    }));
  }
  return runtimeProducts;
}

function saveProducts(products: Product[]): void {
  runtimeProducts = products;
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

function applySort(products: Product[], sort?: ProductListParams["sort"]): Product[] {
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

export const ProductRepoLocal: ProductRepo = {
  async list(params: ProductListParams = {}): Promise<ProductListResult> {
    const {
      search,
      category,
      featured,
      sort = "featured",
      page = 0,
      pageSize = PAGE_SIZE
    } = params;

    let products = ensureSeed();

    if (featured) {
      products = products.filter((product) => product.featured);
    }

    if (category && category !== "all") {
      products = products.filter(
        (product) => product.category.toLowerCase() === category.toLowerCase()
      );
    }

    products = applySearch(products, search);
    products = applySort(products, sort);

    const total = products.length;
    const start = page * pageSize;
    const items = products.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  },

  async listAll(): Promise<Product[]> {
    return ensureSeed();
  },

  async listCategories(): Promise<string[]> {
    const products = ensureSeed();
    return Array.from(new Set(products.map((product) => product.category))).sort();
  },

  async getById(id: string): Promise<Product | null> {
    const products = ensureSeed();
    return products.find((product) => product.id === id) ?? null;
  },

  async getBySlug(slug: string): Promise<Product | null> {
    const products = ensureSeed();
    return products.find((product) => product.slug === slug) ?? null;
  },

  async create(input: ProductInput): Promise<Product> {
    const products = ensureSeed();
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...input,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      slug: input.slug?.trim() || slugify(input.name),
      createdAt: now,
      updatedAt: now
    };
    const updated = [newProduct, ...products];
    saveProducts(updated);
    return newProduct;
  },

  async update(id: string, input: ProductInput): Promise<Product> {
    const products = ensureSeed();
    const now = new Date().toISOString();
    const updated = products.map((product) => {
      if (product.id !== id) return product;
      return {
        ...product,
        ...input,
        slug: input.slug?.trim() || slugify(input.name),
        updatedAt: now
      };
    });
    saveProducts(updated);
    const found = updated.find((product) => product.id === id);
    if (!found) throw new Error("Produto não encontrado.");
    return found;
  },

  async remove(id: string): Promise<void> {
    const products = ensureSeed();
    saveProducts(products.filter((product) => product.id !== id));
  }
};
