export type CouponType = "fixed" | "percent" | "free_shipping";

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CouponPreview = {
  code: string;
  type: CouponType;
  discountAmount: number;
  shippingAmount: number;
  shippingOriginalAmount: number;
  total: number;
};
