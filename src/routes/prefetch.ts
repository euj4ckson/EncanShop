export const routePrefetchers: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Home"),
  "/carrinho": () => import("@/pages/Cart"),
  "/admin": () => import("@/pages/Admin"),
  "/produto": () => import("@/pages/ProductDetail")
};

export function prefetchRoute(path: string) {
  const key = path.startsWith("/produto") ? "/produto" : path;
  const prefetcher = routePrefetchers[key];
  if (prefetcher) {
    void prefetcher();
  }
}



