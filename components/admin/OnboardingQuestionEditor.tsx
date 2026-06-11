"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  validateQuestion, isChoiceType,
  type QuestionType, type OnboardingQuestion,
} from "@/lib/admin/onboarding-helpers";
import { saveQuestion } from "@/lib/admin/onboardingActions";

const TYPE_LABEL: Record<QuestionType, string> = {
  text: "Texto libre",
  number: "Número",
  single_choice: "Selección única",
  multi_choice: "Selección múltiple",
};

export function OnboardingQuestionEditor({
  question,
  onClose,
  onSaved,
}: {
  question: OnboardingQuestion | null; // null = nueva
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(question?.question_text ?? "");
  const [type, setType] = useState<QuestionType>(question?.question_type ?? "text");
  const [required, setRequired] = useState(question?.is_required ?? true);
  const [options, setOptions] = useState<string[]>(question?.options ?? [""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choice = isChoiceType(type);

  function setOption(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setError(null);
    const input = {
      id: question?.id,
      question_text: text,
      question_type: type,
      options: choice ? options : null,
      is_required: required,
    };
    const v = validateQuestion(input);
    if (!v.ok) {
      setError(v.error ?? "Revisa los datos.");
      return;
    }
    setSaving(true);
    const res = await saveQuestion(input);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h3 className="font-head" style={{ fontSize: 17, fontWeight: 700 }}>{question ? "Editar pregunta" : "Nueva pregunta"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gris-texto)" }}><X size={18} /></button>
        </div>

        {/* Texto */}
        <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Pregunta</label>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe la pregunta…"
          className="font-body" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)", fontSize: 14, marginBottom: 16 }} />

        {/* Tipo */}
        <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value as QuestionType)}
          className="font-body" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)", fontSize: 14, marginBottom: 16 }}>
          {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>

        {/* Opciones (solo selección) */}
        {choice && (
          <div style={{ marginBottom: 16 }}>
            <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Opciones</label>
            {question && question.options && question.question_type !== type && (
              <p className="font-body" style={{ fontSize: 11.5, color: "var(--gris-suave)", marginBottom: 6 }}>
                Cambiar el tipo afecta cómo se interpretan respuestas previas.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {options.map((o, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={o} onChange={(e) => setOption(i, e.target.value)} placeholder={`Opción ${i + 1}`}
                    className="font-body" style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--gris-linea)", fontSize: 13.5 }} />
                  <button onClick={() => removeOption(i)} title="Quitar"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gris-suave)" }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button onClick={addOption} className="font-body flex items-center gap-1" style={{ marginTop: 8, background: "none", border: "none", color: "var(--lavanda-dark)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              <Plus size={14} /> Agregar opción
            </button>
          </div>
        )}

        {/* Obligatoria */}
        <label className="font-body flex items-center gap-2" style={{ fontSize: 13.5, marginBottom: 18, cursor: "pointer" }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Obligatoria
        </label>

        {error && <p className="font-body" style={{ color: "var(--error)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 10, padding: "9px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="font-body" style={{ background: "var(--lavanda)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13.5, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
