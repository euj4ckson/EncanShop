import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProductCard } from "@/components/ProductCard";
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

describe("ProductCard", () => {
  it("renders link to product detail", () => {
    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>
    );

    const detailLink = screen.getByRole("link", { name: /ver detalhes/i });
    expect(detailLink).toHaveAttribute("href", "/produto/1");
  });
});

