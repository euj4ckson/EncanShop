import { Instagram, MessageCircle } from "lucide-react";
import { useContacts } from "@/services/useContacts";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export function Footer() {
  const { data: contacts } = useContacts();
  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    "Olá! Quero falar com a EncantArtes."
  );
  const instagramLink = `https://www.instagram.com/${contacts?.instagram || "_encantartes"}`;

  return (
    <footer className="border-t border-sand-200/70 bg-sand-100/70">
      <div className="section-shell grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl text-ink-900">EncantArtes</p>
          <p className="mt-2 text-sm text-ink-600">
            Criamos peças artesanais para transformar momentos simples em memórias.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-sand-200/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
            Feito à mão no Brasil
          </div>
        </div>
        <div className="space-y-3 text-sm text-ink-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Atendimento</p>
          <p>Seg. a Sáb. 09h – 18h</p>
          <p>Entregas para todo o Brasil</p>
        </div>
        <div className="space-y-3 text-sm text-ink-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Contato rápido
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-ink-900"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={instagramLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-ink-900"
          >
            <Instagram className="h-4 w-4" />
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}
