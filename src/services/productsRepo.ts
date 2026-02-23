import type { ProductRepo } from "@/services/productRepo";
import { ProductRepoApi } from "@/services/productRepoApi";
import { ProductRepoLocal } from "@/services/productRepoLocal";

export type ProductsBackendMode = "local" | "api";

function detectBackendMode(): ProductsBackendMode {
  const forced = import.meta.env.VITE_PRODUCTS_BACKEND;
  if (forced === "local") return "local";
  if (forced === "api") return "api";
  return import.meta.env.PROD ? "api" : "local";
}

export const PRODUCTS_BACKEND_MODE = detectBackendMode();

export const ProductsRepo: ProductRepo =
  PRODUCTS_BACKEND_MODE === "api" ? ProductRepoApi : ProductRepoLocal;
