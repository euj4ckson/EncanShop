import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ProductCard } from "@/components/ProductCard";
import { CartProvider, useCart } from "@/store/cart";
import { ToastProvider } from "@/components/ui/Toast";
import type { Product } from "@/types/product";

const product: Product = {
  id: "1",
  name: "Vela Teste",
  slug: "vela-teste",
  price: 49.9,
  description: "Descrição",
  category: "Velas",
  images: ["https://example.com/vela.jpg"],
  featured: false,
  inStock: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function CartCount() {
  const { totalItems } = useCart();
  return <span data-testid="count">{totalItems}</span>;
}

describe("ProductCard", () => {
  it("adds item to cart", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CartProvider>
          <ToastProvider>
            <ProductCard product={product} />
            <CartCount />
          </ToastProvider>
        </CartProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("count")).toHaveTextContent("0");
    await user.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });
});
