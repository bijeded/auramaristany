"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil } from "lucide-react";
import { type QuestionType, type OnboardingQuestion } from "@/lib/admin/onboarding-helpers";
import { reorderQuestions, setQuestionActive } from "@/lib/admin/onboardingActions";
import { OnboardingQuestionEditor } from "./OnboardingQuestionEditor";

const TYPE_LABEL: Record<QuestionType, string> = {
  text: "Texto libre",
  number: "Número",
  single_choice: "Selección única",
  multi_choice: "Selección múltiple",
};

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return <span className="font-body" style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: bg, color }}>{children}</span>;
}

function SortableRow({ q, onEdit, onToggle }: {
  q: OnboardingQuestion; onEdit: () => void; onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: q.id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition,
        border: "1px solid var(--gris-linea)", borderRadius: 12, background: "#fff",
        padding: "12px 14px", marginBottom: 10, opacity: q.is_active ? 1 : 0.55 }}>
      <div className="flex items-center gap-3">
        <button {...attributes} {...listeners} className="cursor-grab" style={{ background: "none", border: "none", color: "var(--gris-suave)" }} title="Arrastrar para reordenar">
          <GripVertical size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{q.question_text}</div>
          <div className="flex gap-2" style={{ marginTop: 5 }}>
            <Badge bg="var(--lavanda-soft)" color="var(--lavanda-dark)">{TYPE_LABEL[q.question_type]}</Badge>
            {q.is_required && <Badge bg="var(--gris-claro)" color="var(--gris-texto)">Obligatoria</Badge>}
            {!q.is_active && <Badge bg="var(--error-tint)" color="var(--error)">Inactiva</Badge>}
          </div>
        </div>
        <button onClick={onToggle} className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--gris-texto)" }}>
          {q.is_active ? "Desactivar" : "Activar"}
        </button>
        <button onClick={onEdit} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--lavanda-dark)" }}>
          <Pencil size={16} />
        </button>
      </div>
    </div>
  );
}

export function OnboardingBuilder({ questions }: { questions: OnboardingQuestion[] }) {
  const router = useRouter();
  const [items, setItems] = useState<OnboardingQuestion[]>(questions);
  const [editing, setEditing] = useState<OnboardingQuestion | null>(null);
  const [creating, setCreating] = useState(false);

  // Re-sincroniza cuando el server revalida tras una acción.
  useEffect(() => setItems(questions), [questions]);

  async function onDragEnd(e: { active: { id: string | number }; over: { id: string | number } | null }) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldI = items.findIndex((q) => q.id === e.active.id);
    const newI = items.findIndex((q) => q.id === e.over!.id);
    const next = [...items];
    const [moved] = next.splice(oldI, 1);
    next.splice(newI, 0, moved);
    setItems(next); // optimista
    await reorderQuestions(next.map((q) => q.id));
    router.refresh();
  }

  async function toggle(q: OnboardingQuestion) {
    await setQuestionActive(q.id, !q.is_active);
    router.refresh();
  }

  function closeEditor() {
    setEditing(null);
    setCreating(false);
  }
  function onSaved() {
    closeEditor();
    router.refresh();
  }

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 760 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>Configuración de Onboarding</h1>
        <button onClick={() => setCreating(true)} className="font-body flex items-center gap-2" style={{ background: "var(--lavanda)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
          <Plus size={16} /> Agregar pregunta
        </button>
      </div>
      <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 13.5, marginBottom: 22 }}>
        Arrastra para reordenar. Las preguntas inactivas no aparecen en el cuestionario del cliente.
      </p>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, border: "1px dashed var(--gris-linea)", borderRadius: 12 }}>
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Aún no hay preguntas. Agrega la primera.</p>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            {items.map((q) => (
              <SortableRow key={q.id} q={q} onEdit={() => setEditing(q)} onToggle={() => toggle(q)} />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {(editing || creating) && (
        <OnboardingQuestionEditor question={editing} onClose={closeEditor} onSaved={onSaved} />
      )}
    </div>
  );
}
