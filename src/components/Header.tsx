import { Instagram, MessageCircle, ShoppingBag } from "lucide-react";
import { PrefetchLink } from "@/routes/PrefetchLink";
import { useCart } from "@/store/cart";
import { CartBadge } from "@/components/CartBadge";
import { useContacts } from "@/services/useContacts";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import logo from "@/assets/logo.svg";

export function Header() {
  const { totalItems } = useCart();
  const { data: contacts } = useContacts();
  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    "Olá! Quero conhecer os produtos da EncantArtes."
  );
  const instagramLink = `https://www.instagram.com/${contacts?.instagram || "_encantartes"}`;

  return (
    <header className="fixed top-0 z-40 w-full border-b border-sand-200/60 bg-sand-50/80 backdrop-blur-xl">
      <div className="section-shell flex items-center justify-between py-3">
        <PrefetchLink to="/" className="flex items-center gap-3">
          <div className="relative">
            <img
              src={logo}
              alt="EncantArtes"
              className="h-11 w-11 rounded-2xl ring-1 ring-white/70 shadow-soft"
            />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-gold-500 ring-2 ring-sand-50" />
          </div>
          <div className="leading-tight">
            <p className="font-serif text-lg font-semibold text-ink-900">EncantArtes</p>
            <p className="text-xs text-ink-500">Velas artesanais & presentes</p>
          </div>
        </PrefetchLink>

        <div className="flex items-center gap-3">
          <a
            href="#produtos"
            className="hidden rounded-full border border-sand-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700 transition hover:bg-white md:inline-flex"
          >
            Produtos
          </a>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-full border border-sand-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-white sm:inline-flex"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={instagramLink}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-full border border-sand-200/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:bg-white sm:inline-flex"
          >
            <Instagram className="h-4 w-4" />
            Instagram
          </a>
          <PrefetchLink
            to="/carrinho"
            className="relative rounded-full p-2 transition hover:bg-white/70"
          >
            <ShoppingBag className="h-6 w-6 text-ink-900" />
            <CartBadge count={totalItems} />
          </PrefetchLink>
        </div>
      </div>
    </header>
  );
}
