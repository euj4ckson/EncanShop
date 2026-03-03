import type { Customer } from "../../src/types/customer";
import type { Fragrance } from "../../src/types/fragrance";
import type { Order } from "../../src/types/order";
import type { Coupon } from "../../src/types/coupon";
import { readJsonValue, withRedisLock, writeJsonValue } from "./redis.js";

type CustomerInternal = Customer & {
  passwordHash: string;
};

const CUSTOMERS_KEY = "encantartes_customers";
const ORDERS_KEY = "encantartes_orders";
const FRAGRANCES_KEY = "encantartes_fragrances";
const COUPONS_KEY = "encantartes_coupons";
const CUSTOMERS_LOCK = "customers";
const ORDERS_LOCK = "orders";
const FRAGRANCES_LOCK = "fragrances";
const COUPONS_LOCK = "coupons";

type LockOptions = {
  ttlSeconds?: number;
  waitMs?: number;
  maxAttempts?: number;
};

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

export async function readCoupons(): Promise<Coupon[]> {
  return readJsonValue<Coupon[]>(COUPONS_KEY, []);
}

export async function writeCoupons(value: Coupon[]): Promise<void> {
  await writeJsonValue(COUPONS_KEY, value);
}

export function stripCustomerSecret(customer: CustomerInternal): Customer {
  const { passwordHash: _passwordHash, ...publicData } = customer;
  return publicData;
}

export async function withCustomersLock<T>(fn: () => Promise<T>, options?: LockOptions): Promise<T> {
  return withRedisLock(CUSTOMERS_LOCK, fn, options);
}

export async function withOrdersLock<T>(fn: () => Promise<T>, options?: LockOptions): Promise<T> {
  return withRedisLock(ORDERS_LOCK, fn, options);
}

export async function withFragrancesLock<T>(fn: () => Promise<T>, options?: LockOptions): Promise<T> {
  return withRedisLock(FRAGRANCES_LOCK, fn, options);
}

export async function withCouponsLock<T>(fn: () => Promise<T>, options?: LockOptions): Promise<T> {
  return withRedisLock(COUPONS_LOCK, fn, options);
}

