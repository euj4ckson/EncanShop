import { requestJson } from "@/services/http";

export type CheckoutConfig = {
  mercadopagoPublicKey: string;
  maxInstallments: number;
};

export const CheckoutRepo = {
  async config(): Promise<CheckoutConfig> {
    return requestJson<CheckoutConfig>("/api/checkout-config");
  }
};

