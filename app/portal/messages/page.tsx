import { createClient } from "@/lib/supabase/server";
import { getInboxMessages } from "@/lib/content/messages";
import { normalizeWhatsappNumber } from "@/lib/admin/message-helpers";
import { MessagesList } from "@/components/portal/MessagesList";
import { serverToday } from "@/lib/content/server-today";

// Etiqueta de fecha para el PortalHeader (respeta DEV_DATE en dev, como /pilares).
function todayLabel(): string {
  const base = serverToday();
  const s = base.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function PortalMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const items = user ? await getInboxMessages(user.id) : [];
  const auraWhatsapp = normalizeWhatsappNumber(process.env.NEXT_PUBLIC_AURA_WHATSAPP);
  return <MessagesList items={items} auraWhatsapp={auraWhatsapp} dateLabel={todayLabel()} />;
}
