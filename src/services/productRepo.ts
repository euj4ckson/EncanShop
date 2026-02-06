import type { Product, ProductInput } from "@/types/product";

export type ProductSort = "featured" | "newest" | "price-asc" | "price-desc";

export type ProductListParams = {
  search?: string;
  category?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  featured?: boolean;
};

export type ProductListResult = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

export interface ProductRepo {
  list(params?: ProductListParams): Promise<ProductListResult>;
  listAll(): Promise<Product[]>;
  listCategories(): Promise<string[]>;
  getById(id: string): Promise<Product | null>;
  getBySlug(slug: string): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  update(id: string, input: ProductInput): Promise<Product>;
  remove(id: string): Promise<void>;
}



