import { readFileSync } from "node:fs";
import type { Customer } from "../../src/types/customer";
import type { Fragrance } from "../../src/types/fragrance";
import type { Order } from "../../src/types/order";
import type { Product } from "../../src/types/product";
import { readJsonValue, writeJsonValue } from "./redis";

type CustomerInternal = Customer & {
  passwordHash: string;
};

const seedProducts = JSON.parse(
  readFileSync(new URL("../../src/data/seedProducts.json", import.meta.url), "utf8")
) as Product[];

const CUSTOMERS_KEY = "encantartes_customers";
const ORDERS_KEY = "encantartes_orders";
const FRAGRANCES_KEY = "encantartes_fragrances";
const PRODUCTS_KEY = "encantartes_products";

export async function readCustomers(): Promise<CustomerInternal[]> {
  return readJsonValue<CustomerInternal[]>(CUSTOMERS_KEY, []);
}

export async function writeCustomers(value: CustomerInternal[]): Promise<void> {
  await writeJsonValue(CUSTOMERS_KEY, value);
}

export async function readOrders(): Promise<Order[]> {
  return readJsonValue<Order[]>(ORDERS_KEY, []);
}

export async function writeOrders(value: Order[]): Promise<void> {
  await writeJsonValue(ORDERS_KEY, value);
}

export async function readFragrances(): Promise<Fragrance[]> {
  return readJsonValue<Fragrance[]>(FRAGRANCES_KEY, []);
}

export async function writeFragrances(value: Fragrance[]): Promise<void> {
  await writeJsonValue(FRAGRANCES_KEY, value);
}

export async function readProducts(): Promise<Product[]> {
  return readJsonValue<Product[]>(PRODUCTS_KEY, seedProducts);
}

export function stripCustomerSecret(customer: CustomerInternal): Customer {
  const { passwordHash: _passwordHash, ...publicData } = customer;
  return publicData;
}

