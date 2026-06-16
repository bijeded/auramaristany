// lib/onboarding/responses-validation.ts
export interface ActiveQuestion {
  id: string;
  is_required: boolean;
}

export type ResponsesValidation = { ok: true } | { ok: false; error: string };

export function validateResponses(
  activeQuestions: ActiveQuestion[],
  responses: Record<string, string | string[]>
): ResponsesValidation {
  for (const q of activeQuestions) {
    if (!q.is_required) continue;
    const ans = responses[q.id];
    const empty = ans == null || ans === "" || (Array.isArray(ans) && ans.length === 0);
    if (empty) {
      return { ok: false, error: "Faltan respuestas obligatorias." };
    }
  }
  return { ok: true };
}
