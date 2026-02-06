export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  description: string;
  category: string;
  images: string[];
  featured: boolean;
  inStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt" | "slug"> & {
  slug?: string;
};



