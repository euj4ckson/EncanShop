import type { Coupon, CouponType } from "../../src/types/coupon";

export type CouponCalculation = {
  discountAmount: number;
  shippingAmount: number;
  shippingOriginalAmount: number;
  total: number;
};

export function normalizeCouponCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
}

export function validateCouponPayload(input: {
  code: string;
  type: CouponType;
  value: number;
}): string | null {
  if (input.code.length < 3 || input.code.length > 32) {
    return "Codigo do cupom invalido.";
  }

  if (!["fixed", "percent", "free_shipping"].includes(input.type)) {
    return "Tipo de cupom invalido.";
  }

  if (input.type === "free_shipping") return null;

  if (!Number.isFinite(input.value) || input.value <= 0) {
    return "Valor do cupom invalido.";
  }

  if (input.type === "percent" && input.value > 100) {
    return "Cupom percentual nao pode passar de 100%.";
  }

  return null;
}

export function calculateCouponDiscount(input: {
  coupon: Coupon;
  subtotal: number;
  shippingAmount: number;
}): CouponCalculation {
  const subtotal = Math.max(0, Number(input.subtotal || 0));
  const shippingOriginalAmount = Math.max(0, Number(input.shippingAmount || 0));

  let discountAmount = 0;
  let shippingAmount = shippingOriginalAmount;

  if (input.coupon.type === "fixed") {
    discountAmount = Math.min(subtotal, Number(input.coupon.value || 0));
  } else if (input.coupon.type === "percent") {
    discountAmount = Number(((subtotal * Number(input.coupon.value || 0)) / 100).toFixed(2));
    discountAmount = Math.min(subtotal, Math.max(0, discountAmount));
  } else if (input.coupon.type === "free_shipping") {
    discountAmount = shippingOriginalAmount;
    shippingAmount = 0;
  }

  const total = Number(Math.max(0, subtotal + shippingAmount - discountAmount).toFixed(2));
  return {
    discountAmount: Number(discountAmount.toFixed(2)),
    shippingAmount: Number(shippingAmount.toFixed(2)),
    shippingOriginalAmount: Number(shippingOriginalAmount.toFixed(2)),
    total
  };
}
