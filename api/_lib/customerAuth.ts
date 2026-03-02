import { json, readBearerToken } from "./http";
import { verifyCustomerToken } from "./security";
import { readCustomers } from "./store";

export async function getAuthedCustomer(req: any) {
  const token = readBearerToken(req);
  if (!token) return null;
  const payload = verifyCustomerToken(token);
  if (!payload) return null;

  const customers = await readCustomers();
  const customer = customers.find((item) => item.id === payload.sub && item.email === payload.email);
  return customer || null;
}

export async function requireAuthedCustomer(req: any, res: any) {
  const customer = await getAuthedCustomer(req);
  if (!customer) {
    json(res, 401, { error: "Nao autenticado." });
    return null;
  }
  return customer;
}

