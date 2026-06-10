"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getActiveSubscriberRows } from "./queries";
import { expandRecipients, type RecipientSelection } from "./message-helpers";
import { sendNewMessageEmailBatch } from "@/lib/email/send";

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

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  // Nota deliberada: usamos el cliente con contexto de usuario (no service-role).
  // Las policies messages_admin_write / message_recipients_admin_write (migración 001)
  // permiten la escritura del admin vía is_admin(), así que RLS hace de guard adicional.
  // Si esas policies se endurecen en el futuro, revisar este insert. Los `as any` de
  // abajo son por los tipos de Supabase desactualizados (convención del repo, ver dayActions).
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((prof as { role?: string } | null)?.role !== "admin") return { ok: false, error: "No autorizado" };

  if (!input.subject.trim() || !input.body.trim()) {
    return { ok: false, error: "Asunto y mensaje son obligatorios" };
  }

  const rows = await getActiveSubscriberRows();
  const recipientIds = expandRecipients(rows, input.selection);
  if (recipientIds.length === 0) return { ok: false, error: "No hay destinatarias activas para ese filtro" };

  const isBroadcast = input.selection.mode !== "individual";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg, error: msgErr } = await (supabase as any)
    .from("messages")
    .insert({ sender_id: user.id, subject: input.subject.trim(), body: input.body.trim(), is_broadcast: isBroadcast })
    .select("id")
    .single();
  if (msgErr) return { ok: false, error: msgErr.message };

  const recipRows = recipientIds.map((rid) => ({ message_id: msg.id, recipient_id: rid }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rErr } = await (supabase as any).from("message_recipients").insert(recipRows);
  if (rErr) return { ok: false, error: rErr.message };

  // Emails best-effort — un fallo no revierte el mensaje in-app.
  const idSet = new Set(recipientIds);
  const emails = Array.from(new Set(rows.filter((r) => idSet.has(r.profile_id)).map((r) => r.email).filter(Boolean)));
  await sendNewMessageEmailBatch(emails, input.subject.trim());

  revalidatePath("/admin/messages");
  return { ok: true, count: recipientIds.length };
}
