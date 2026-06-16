import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface InboxItem {
  id: string;
  subject: string;
  preview: string;
  createdAt: string;
  read: boolean;
}

export interface MessageDetail {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
}

export async function getInboxMessages(userId: string): Promise<InboxItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_recipients")
    .select("read_at, messages(id, subject, body, created_at)")
    .eq("recipient_id", userId);

  // keep: message_recipients JOIN messages — nested join shape not inferred by SDK.
  type Raw = { read_at: string | null; messages: { id: string; subject: string; body: string; created_at: string } | null };
  return ((data ?? []) as Raw[])
    .filter((r) => r.messages)
    .map((r) => ({
      id: r.messages!.id,
      subject: r.messages!.subject,
      preview: r.messages!.body.replace(/\s+/g, " ").trim().slice(0, 80),
      createdAt: r.messages!.created_at,
      read: r.read_at != null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("message_recipients")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function getMessageDetail(userId: string, messageId: string): Promise<MessageDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_recipients")
    .select("messages(id, subject, body, created_at)")
    .eq("recipient_id", userId)
    .eq("message_id", messageId)
    .maybeSingle();

  // keep: message_recipients JOIN messages — nested join shape not inferred by SDK.
  type Raw = { messages: { id: string; subject: string; body: string; created_at: string } | null } | null;
  const row = data as Raw;
  if (!row?.messages) return null;
  return {
    id: row.messages.id,
    subject: row.messages.subject,
    body: row.messages.body,
    createdAt: row.messages.created_at,
  };
}
