import { getSentMessages, getActiveSubscriberRows } from "@/lib/admin/queries";
import { buildRecipientGroups, normalizeWhatsappNumber } from "@/lib/admin/message-helpers";
import { MessagesAdmin, type ClientOption } from "@/components/admin/MessagesAdmin";

export default async function AdminMessagesPage() {
  const [sent, rows] = await Promise.all([getSentMessages(), getActiveSubscriberRows()]);
  const groups = buildRecipientGroups(rows);

  const clientMap = new Map<string, ClientOption>();
  for (const r of rows) {
    if (!clientMap.has(r.profile_id)) {
      clientMap.set(r.profile_id, {
        id: r.profile_id,
        name: r.full_name ?? r.email,
        whatsapp: normalizeWhatsappNumber(r.phone),
      });
    }
  }
  const clients = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return <MessagesAdmin sent={sent} groups={groups} clients={clients} />;
}
