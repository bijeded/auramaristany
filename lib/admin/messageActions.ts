"use server";

import { revalidatePath } from "next/cache";
import { getActiveSubscriberRows } from "./queries";
import { expandRecipients, validateMessageContent, type RecipientSelection } from "./message-helpers";
import { sendNewMessageEmailBatch } from "@/lib/email/send";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";

export interface SendMessageInput {
  subject: string;
  body: string;
  selection: RecipientSelection;
}

export interface SendMessageResult {
  ok: boolean;
  error?: string;
  count?: number;
}

export interface SentRecipient {
  name: string;
  read: boolean;
}

export interface SentMessageDetail {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  isBroadcast: boolean;
  recipients: SentRecipient[];
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  // Nota deliberada: usamos el cliente con contexto de usuario (no service-role).
  // Las policies messages_admin_write / message_recipients_admin_write (migración 001)
  // permiten la escritura del admin vía is_admin(), así que RLS hace de guard adicional.
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user } = auth;

  const contentCheck = validateMessageContent(input.subject, input.body);
  if (!contentCheck.ok) return { ok: false, error: contentCheck.error };

  const rows = await getActiveSubscriberRows();
  const recipientIds = expandRecipients(rows, input.selection);
  if (recipientIds.length === 0) return { ok: false, error: "No hay destinatarias activas para ese filtro" };

  const isBroadcast = input.selection.mode !== "individual";

  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({ sender_id: user.id, subject: input.subject.trim(), body: input.body.trim(), is_broadcast: isBroadcast })
    .select("id")
    .single();
  if (msgErr) return { ok: false, error: logAndGeneric("sendMessage.insert", msgErr) };

  const recipRows = recipientIds.map((rid) => ({ message_id: msg!.id, recipient_id: rid }));
  const { error: rErr } = await supabase.from("message_recipients").insert(recipRows);
  if (rErr) return { ok: false, error: logAndGeneric("sendMessage.recipients", rErr) };

  // Emails best-effort — un fallo no revierte el mensaje in-app.
  const idSet = new Set(recipientIds);
  const emails = Array.from(new Set(rows.filter((r) => idSet.has(r.profile_id)).map((r) => r.email).filter(Boolean)));
  await sendNewMessageEmailBatch(emails, input.subject.trim());

  revalidatePath("/admin/messages");
  return { ok: true, count: recipientIds.length };
}

// Detalle de un mensaje enviado (admin): cuerpo + destinatarias con su estado de lectura.
export async function getSentMessageDetail(messageId: string): Promise<SentMessageDetail | null> {
  const auth = await requireAdmin();
  if (!auth.ok) return null;
  const { supabase } = auth;

  const { data: msg } = await supabase
    .from("messages")
    .select("id, subject, body, is_broadcast, created_at")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return null;
  // msg is typed by the SDK; alias to m for cleaner access.
  const m = msg;

  const { data: recips } = await supabase
    .from("message_recipients")
    .select("read_at, profiles(full_name, email)")
    .eq("message_id", messageId);

  // keep: message_recipients JOIN profiles — nested join shape not inferred by SDK.
  type RecRow = { read_at: string | null; profiles: { full_name: string | null; email: string | null } | null };
  const recipients: SentRecipient[] = ((recips ?? []) as RecRow[])
    .map((r) => ({ name: r.profiles?.full_name ?? r.profiles?.email ?? "—", read: r.read_at != null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: m.id,
    subject: m.subject,
    body: m.body,
    createdAt: m.created_at,
    isBroadcast: m.is_broadcast,
    recipients,
  };
}

// Elimina un mensaje y sus filas de message_recipients (desaparece también de la
// bandeja de los clientes). Borra las destinatarias primero por la FK (sin cascade).
export async function deleteMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase } = auth;

  const { error: rErr } = await supabase.from("message_recipients").delete().eq("message_id", messageId);
  if (rErr) return { ok: false, error: logAndGeneric("deleteMessage.recipients", rErr) };

  const { error: mErr } = await supabase.from("messages").delete().eq("id", messageId);
  if (mErr) return { ok: false, error: logAndGeneric("deleteMessage", mErr) };

  revalidatePath("/admin/messages");
  return { ok: true };
}
