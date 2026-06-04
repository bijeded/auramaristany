"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface Question {
  id: string;
  question_text: string;
  question_type: "text" | "number" | "single_choice" | "multi_choice";
  options: string[] | null;
  is_required: boolean;
}

export function QuestionnaireForm({
  questions,
  profileId,
}: {
  questions: Question[];
  profileId: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id: string, option: string) {
    const current = (answers[id] as string[]) ?? [];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    setAnswer(id, updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const q of questions) {
      if (q.is_required) {
        const ans = answers[q.id];
        const isEmpty = !ans || (Array.isArray(ans) && ans.length === 0) || ans === "";
        if (isEmpty) {
          setError(`Por favor responde: "${q.question_text}"`);
          return;
        }
      }
    }

    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const { error: upsertError } = await supabase.from("onboarding_responses").upsert({
      profile_id: profileId,
      responses: answers,
      completed_at: new Date().toISOString(),
    });

    if (upsertError) {
      setError("Error al guardar tus respuestas. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", profileId);

    if (updateError) {
      setError("Error al actualizar tu perfil. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    router.push("/portal/today");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-8">
      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-2">
          <label
            className="font-head text-sm uppercase tracking-wide"
            style={{ color: "var(--negro)" }}
          >
            {q.question_text}
            {q.is_required && (
              <span style={{ color: "var(--lavanda)" }}> *</span>
            )}
          </label>

          {q.question_type === "text" && (
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
              style={{ borderColor: "var(--gris-linea)", minHeight: 80 }}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          )}

          {q.question_type === "number" && (
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gris-linea)" }}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          )}

          {(q.question_type === "single_choice" || q.question_type === "multi_choice") &&
            q.options &&
            q.options.map((option) => {
              const selected =
                q.question_type === "single_choice"
                  ? answers[q.id] === option
                  : ((answers[q.id] as string[]) ?? []).includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    q.question_type === "single_choice"
                      ? setAnswer(q.id, option)
                      : toggleMulti(q.id, option)
                  }
                  className="w-full text-left px-4 py-3 rounded-lg text-sm border transition-colors"
                  style={{
                    borderColor: selected ? "var(--lavanda)" : "var(--gris-linea)",
                    background: selected ? "var(--lavanda-soft)" : "white",
                    color: selected ? "var(--lavanda-dark)" : "var(--negro)",
                  }}
                >
                  {option}
                </button>
              );
            })}
        </div>
      ))}

      {error && (
        <p className="text-sm" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full font-head uppercase tracking-wider"
        style={{ background: "var(--lavanda)", color: "#fff" }}
      >
        {loading ? "Guardando..." : "Comenzar mi programa"}
      </Button>
    </form>
  );
}
