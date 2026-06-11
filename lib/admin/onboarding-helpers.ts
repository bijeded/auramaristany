export type QuestionType = "text" | "number" | "single_choice" | "multi_choice";

export interface QuestionInput {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
}

export interface OnboardingQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  cleanedOptions: string[] | null;
}

export function isChoiceType(t: QuestionType): boolean {
  return t === "single_choice" || t === "multi_choice";
}

export function validateQuestion(input: QuestionInput): ValidationResult {
  const text = input.question_text.trim();
  if (!text) {
    return { ok: false, error: "El texto de la pregunta es obligatorio.", cleanedOptions: null };
  }
  if (!isChoiceType(input.question_type)) {
    return { ok: true, cleanedOptions: null };
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const o of input.options ?? []) {
    const t = o.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      cleaned.push(t);
    }
  }
  if (cleaned.length === 0) {
    return { ok: false, error: "Agrega al menos una opción para este tipo de pregunta.", cleanedOptions: null };
  }
  return { ok: true, cleanedOptions: cleaned };
}

export function reindexOrder(orderedIds: string[]): { id: string; sort_order: number }[] {
  return orderedIds.map((id, i) => ({ id, sort_order: i }));
}
