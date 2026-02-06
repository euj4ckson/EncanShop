import { MessageCircle } from "lucide-react";
import { useContacts } from "@/services/useContacts";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export function FloatingWhatsApp() {
  const { data: contacts } = useContacts();
  const whatsappLink = buildWhatsAppLink(
    contacts?.whatsapp || "553291109045",
    "Olá! Gostaria de ajuda para escolher um presente."
  );

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink-900 text-sand-50 shadow-card transition hover:scale-105 hover:shadow-soft focus-ring"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
