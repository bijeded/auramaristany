"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { ADMIN_GENERIC_ERROR, logAndGeneric } from "./errors";
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
): Promise<{ error?: string; saved?: { subject: string; body: string } }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Mensaje automático no válido" };

  // Se sanea ANTES de validar longitudes: lo que se mide es lo que se guarda.
  const subject = sanitizePlainTextBody(parsed.data.subject);
  const body = sanitizePlainTextBody(parsed.data.body);

  const v = validateMessageContent(subject, body);
  if (!v.ok) return { error: v.error };

  // `.select()` para no dar por buena una escritura de 0 filas: PostgREST no
  // devuelve error si RLS filtra la fila o si la regla no existe, y sin esto la
  // pantalla diría "Guardado" mientras el cron sigue mandando el texto viejo.
  const { data, error } = await auth.supabase
    .from("automated_messages")
    .update({ subject, body })
    .eq("rule", parsed.data.rule)
    .select("rule")
    .maybeSingle();
  if (error) return { error: logAndGeneric("updateAutomatedMessage", error) };
  if (!data) return { error: ADMIN_GENERIC_ERROR };

  revalidate();
  // Se devuelve lo guardado, no lo enviado: el saneado puede haber cambiado el
  // texto y el formulario tiene que reflejar la versión que quedó en la base.
  return { saved: { subject, body } };
}

const toggleSchema = z.object({ rule: ruleSchema, isActive: z.boolean() });

export async function toggleAutomatedMessage(
  rule: NoticeRule,
  isActive: boolean
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = toggleSchema.safeParse({ rule, isActive });
  if (!parsed.success) return { error: "Mensaje automático no válido" };

  const { data, error } = await auth.supabase
    .from("automated_messages")
    .update({ is_active: parsed.data.isActive })
    .eq("rule", parsed.data.rule)
    .select("rule")
    .maybeSingle();
  if (error) return { error: logAndGeneric("toggleAutomatedMessage", error) };
  if (!data) return { error: ADMIN_GENERIC_ERROR };

  revalidate();
  return {};
}
