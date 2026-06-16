// lib/onboarding/responsesActions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { validateResponses, type ActiveQuestion } from "./responses-validation";

const GENERIC_ERROR = "No se pudieron guardar tus respuestas. Intenta más tarde.";

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitOnboarding(
  responses: Record<string, string | string[]>
): Promise<SubmitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  // Revalida contra las preguntas ACTIVAS (no se confía en el cliente).
  const { data: qRaw } = await supabase
    .from("onboarding_questions")
    .select("id, is_required")
    .eq("is_active", true);
  const activeQuestions = (qRaw as ActiveQuestion[] | null) ?? [];

  const check = validateResponses(activeQuestions, responses);
  if (!check.ok) return check;

  // profileId SIEMPRE = user.id (se ignora cualquier valor del cliente).
  const { error: upsertError } = await supabase.from("onboarding_responses").upsert({
    profile_id: user.id,
    responses: responses as import("@/lib/supabase/types").Json,
    completed_at: new Date().toISOString(),
  });
  if (upsertError) {
    console.error("[submitOnboarding.upsert]", upsertError);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  if (updateError) {
    console.error("[submitOnboarding.profile]", updateError);
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
