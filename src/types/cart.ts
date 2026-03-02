export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image?: string;
  variant?: string;
  fragrance?: string;
  quantity: number;
};

export type CartState = {
  items: CartItem[];
};
