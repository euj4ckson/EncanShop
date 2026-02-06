import * as React from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { isSessionValid } from "@/lib/auth";

const Home = React.lazy(() => import("@/pages/Home").then((m) => ({ default: m.Home })));
const ProductDetail = React.lazy(() =>
  import("@/pages/ProductDetail").then((m) => ({ default: m.ProductDetail }))
);
const Cart = React.lazy(() => import("@/pages/Cart").then((m) => ({ default: m.Cart })));
const AdminPage = React.lazy(() => import("@/pages/Admin").then((m) => ({ default: m.Admin })));
const AdminLogin = React.lazy(() =>
  import("@/pages/AdminLogin").then((m) => ({ default: m.AdminLogin }))
);
const NotFound = React.lazy(() =>
  import("@/pages/NotFound").then((m) => ({ default: m.NotFound }))
);

function SiteLayout() {
  return (
    <div>
      <Header />
      <main className="pt-20">
        <React.Suspense fallback={<div className="px-4 pt-24">Carregando...</div>}>
          <Outlet />
        </React.Suspense>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}

function AdminGate() {
  const [authed, setAuthed] = React.useState(() => isSessionValid());

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setAuthed(isSessionValid());
    }, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <React.Suspense fallback={<div className="px-4 pt-24">Carregando...</div>}>
      {authed ? (
        <AdminPage onLogout={() => setAuthed(false)} />
      ) : (
        <AdminLogin onSuccess={() => setAuthed(true)} />
      )}
    </React.Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SiteLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "produto/:id", element: <ProductDetail /> },
      { path: "carrinho", element: <Cart /> }
    ]
  },
  {
    path: "/admin",
    element: <AdminGate />
  },
  {
    path: "*",
    element: <NotFound />
  }
]);


