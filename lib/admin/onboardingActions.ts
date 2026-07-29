"use server";

import { revalidatePath } from "next/cache";
import { validateQuestion, reindexOrder, type QuestionInput } from "./onboarding-helpers";
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
  if (orderedIds.length === 0) return {};

  // Las posiciones las calcula reindexOrder —su único hogar, con tests—; la
  // función de la base sólo las aplica, y las aplica de una sola vez. El bucle
  // de `update` que había aquí repetía esa regla sin tests y, al salir al
  // primer error, podía dejar el cuestionario renumerado a medias.
  //
  // keep: declarar la función en `Database["public"]["Functions"]` NO es opción.
  // Con Functions vacío supabase-js resuelve los embeds de forma laxa; en cuanto
  // se puebla, pasa a resolverlos contra `Relationships`, que en este proyecto
  // están a `[]` a propósito (types.ts se mantiene a mano) — y entonces revientan
  // TODOS los selects con join del repo, no sólo éste. Se tipa el rpc aquí.
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: { payload: { id: string; sort_order: number }[]; expected: number }
  ) => Promise<{ data: number | null; error: { message: string } | null }>;

  // Se le manda cuántas filas debe tocar, y la función levanta si no coinciden.
  // Comprobarlo aquí, con la respuesta ya en la mano, llegaría tarde: el update
  // habría hecho commit y estaríamos devolviendo "error" sobre una base sí
  // modificada, que es el orden a medias que este cambio viene a quitar.
  const { error } = await rpc("reorder_onboarding_questions", {
    payload: reindexOrder(orderedIds),
    expected: orderedIds.length,
  });
  if (error) return { error: logAndGeneric("reorderQuestions", error) };

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
