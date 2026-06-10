import { createClient } from "@/lib/supabase/server";
import { getInboxMessages } from "@/lib/content/messages";
import { normalizeWhatsappNumber } from "@/lib/admin/message-helpers";
import { MessagesList } from "@/components/portal/MessagesList";

export default async function PortalMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const items = user ? await getInboxMessages(user.id) : [];
  const auraWhatsapp = normalizeWhatsappNumber(process.env.NEXT_PUBLIC_AURA_WHATSAPP);
  return <MessagesList items={items} auraWhatsapp={auraWhatsapp} />;
}
