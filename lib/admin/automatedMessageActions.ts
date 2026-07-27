"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";
import { sanitizePlainTextBody } from "./sanitize-html";
import { validateMessageContent } from "./message-helpers";
import type { NoticeRule } from "@/lib/supabase/types";

// La lista de reglas es cerrada: cada una tiene su disparador en `lib/cron/`,
// así que sólo se puede editar una fila que ya existe. Nada de crear/borrar.
const ruleSchema = z.enum(["booking_reminder", "inactivity_nudge"]);

const updateSchema = z.object({
  rule: ruleSchema,
  subject: z.string(),
  body: z.string(),
});

export interface AutomatedMessageInput {
  rule: NoticeRule;
  subject: string;
  body: string;
}

function revalidate() {
  revalidatePath("/admin/automated-messages");
}

export async function updateAutomatedMessage(
  input: AutomatedMessageInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Mensaje automático no válido" };

  // Se sanea ANTES de validar longitudes: lo que se mide es lo que se guarda.
  const subject = sanitizePlainTextBody(parsed.data.subject);
  const body = sanitizePlainTextBody(parsed.data.body);

  const v = validateMessageContent(subject, body);
  if (!v.ok) return { error: v.error };

  const { error } = await auth.supabase
    .from("automated_messages")
    .update({ subject, body })
    .eq("rule", parsed.data.rule);
  if (error) return { error: logAndGeneric("updateAutomatedMessage", error) };

  revalidate();
  return {};
}

export async function toggleAutomatedMessage(
  rule: NoticeRule,
  isActive: boolean
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = ruleSchema.safeParse(rule);
  if (!parsed.success) return { error: "Mensaje automático no válido" };

  const { error } = await auth.supabase
    .from("automated_messages")
    .update({ is_active: isActive })
    .eq("rule", parsed.data);
  if (error) return { error: logAndGeneric("toggleAutomatedMessage", error) };

  revalidate();
  return {};
}
