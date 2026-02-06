import React, { createContext, useContext, useMemo, useReducer } from "react";
import { CART_STORAGE_KEY } from "@/lib/config";
import { readStorage, writeStorage } from "@/lib/storage";
import type { CartItem, CartState } from "@/types/cart";

const emptyState: CartState = { items: [] };

type CartAction =
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; productId: string }
  | { type: "UPDATE"; productId: string; quantity: number }
  | { type: "CLEAR" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find((item) => item.productId === action.item.productId);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === action.item.productId
              ? { ...item, quantity: item.quantity + action.item.quantity }
              : item
          )
        };
      }
      return { items: [action.item, ...state.items] };
    }
    case "REMOVE":
      return { items: state.items.filter((item) => item.productId !== action.productId) };
    case "UPDATE":
      return {
        items: state.items.map((item) =>
          item.productId === action.productId
            ? { ...item, quantity: Math.max(1, action.quantity) }
            : item
        )
      };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

function getInitialState(): CartState {
  return readStorage(CART_STORAGE_KEY, emptyState);
}

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, emptyState, getInitialState);

  React.useEffect(() => {
    writeStorage(CART_STORAGE_KEY, state);
  }, [state]);

  const value = useMemo(() => {
    const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    return {
      items: state.items,
      totalItems,
      subtotal,
      addItem: (item: CartItem) => dispatch({ type: "ADD", item }),
      removeItem: (productId: string) => dispatch({ type: "REMOVE", productId }),
      updateQuantity: (productId: string, quantity: number) =>
        dispatch({ type: "UPDATE", productId, quantity }),
      clear: () => dispatch({ type: "CLEAR" })
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}


