export function calculateFreight(cep: string, subtotal: number): { amount: number; etaDays: number } {
  if (subtotal >= 250) {
    return { amount: 0, etaDays: 5 };
  }

  const first = Number(cep.slice(0, 1));
  if (!Number.isFinite(first)) {
    return { amount: 24.9, etaDays: 8 };
  }

  if (first <= 1) return { amount: 14.9, etaDays: 3 };
  if (first <= 3) return { amount: 16.9, etaDays: 4 };
  if (first <= 5) return { amount: 18.9, etaDays: 5 };
  if (first <= 7) return { amount: 22.9, etaDays: 6 };
  return { amount: 26.9, etaDays: 8 };
}

