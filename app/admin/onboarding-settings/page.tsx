import { createClient } from "@/lib/supabase/server";
import { OnboardingBuilder } from "@/components/admin/OnboardingBuilder";
import type { OnboardingQuestion } from "@/lib/admin/onboarding-helpers";

export default async function AdminOnboardingSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("onboarding_questions")
    .select("id, question_text, question_type, options, is_required, is_active, sort_order")
    .order("sort_order");

  const questions = (data as unknown as OnboardingQuestion[] | null) ?? [];
  return <OnboardingBuilder questions={questions} />;
}
