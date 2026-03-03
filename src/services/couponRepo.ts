import type { Coupon, CouponPreview, CouponType } from "@/types/coupon";
import { requestJson } from "@/services/http";
import { getAdminPassword } from "@/lib/auth";

function adminHeaders(): HeadersInit {
  return {
    "x-admin-password": getAdminPassword()
  };
}

export const CouponRepo = {
  async listForAdmin(): Promise<Coupon[]> {
    return requestJson<Coupon[]>(
      "/api/coupons",
      {
        headers: adminHeaders()
      },
      { mode: "all" }
    );
  },

  async create(input: { code: string; type: CouponType; value: number; active?: boolean }): Promise<Coupon> {
    return requestJson<Coupon>("/api/coupons", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(input)
    });
  },

  async update(
    id: string,
    input: { code?: string; type?: CouponType; value?: number; active?: boolean }
  ): Promise<Coupon> {
    return requestJson<Coupon>(
      "/api/coupons",
      {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(input)
      },
      { id }
    );
  },

  async remove(id: string): Promise<void> {
    await requestJson<void>(
      "/api/coupons",
      {
        method: "DELETE",
        headers: adminHeaders()
      },
      { id }
    );
  },

  async validate(input: {
    code: string;
    subtotal: number;
    shippingAmount: number;
  }): Promise<CouponPreview> {
    return requestJson<CouponPreview>(
      "/api/coupons",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      { mode: "validate" }
    );
  }
};
