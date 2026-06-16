import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuestionnaireForm } from "./QuestionnaireForm";

interface DbQuestion {
  id: string;
  question_text: string;
  question_type: "text" | "number" | "single_choice" | "multi_choice";
  options: string[] | null;
  is_required: boolean;
}

export default async function QuestionnairePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  const profile = profileRaw as { onboarding_completed: boolean } | null;

  if (profile?.onboarding_completed) redirect("/portal/today");

  const { data: questionsRaw } = await supabase
    .from("onboarding_questions")
    .select("id, question_text, question_type, options, is_required")
    .eq("is_active", true)
    .order("sort_order");

  const questions = (questionsRaw as DbQuestion[] | null) ?? [];

  return (
    <div className="flex flex-col items-center p-6">
      <div
        className="rounded-xl bg-white p-8 w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h1 className="font-head text-xl mb-1">Cuéntanos sobre ti</h1>
        <p className="text-sm mb-6" style={{ color: "var(--gris-texto)" }}>
          Aura personalizará tu experiencia con tus respuestas.
        </p>
        <QuestionnaireForm questions={questions} />
      </div>
    </div>
  );
}
