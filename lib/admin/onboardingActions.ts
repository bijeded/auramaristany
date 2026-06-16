"use server";

import { revalidatePath } from "next/cache";
import { validateQuestion, type QuestionInput } from "./onboarding-helpers";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";

function revalidate() {
  revalidatePath("/admin/onboarding-settings");
  revalidatePath("/onboarding/questionnaire");
}

export async function saveQuestion(input: QuestionInput): Promise<{ id: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { id: input.id ?? "", error: auth.error };
  const v = validateQuestion(input);
  if (!v.ok) return { id: input.id ?? "", error: v.error };

  const supabase = auth.supabase;

  const row = {
    question_text: input.question_text.trim(),
    question_type: input.question_type,
    options: v.cleanedOptions,
    is_required: input.is_required,
  };

  if (input.id) {
    const { error } = await supabase.from("onboarding_questions").update(row).eq("id", input.id);
    if (error) return { id: input.id, error: logAndGeneric("saveQuestion.update", error) };
    revalidate();
    return { id: input.id };
  }

  // Nueva: sort_order = (max actual) + 1, is_active = true.
  const { data: maxRow } = await supabase
    .from("onboarding_questions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("onboarding_questions")
    .insert({ ...row, sort_order: nextOrder, is_active: true })
    .select("id")
    .single();
  if (error) return { id: "", error: logAndGeneric("saveQuestion.insert", error) };
  revalidate();
  return { id: inserted.id };
}

export async function reorderQuestions(orderedIds: string[]): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("onboarding_questions")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return { error: logAndGeneric("reorderQuestions", error) };
  }
  revalidate();
  return {};
}

export async function setQuestionActive(id: string, active: boolean): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  const { error } = await supabase.from("onboarding_questions").update({ is_active: active }).eq("id", id);
  if (error) return { error: logAndGeneric("setQuestionActive", error) };
  revalidate();
  return {};
}
