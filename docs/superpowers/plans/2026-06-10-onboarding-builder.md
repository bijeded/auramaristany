# Constructor de Formulario de Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el stub `/admin/onboarding-settings` en un constructor donde el admin crea/edita/reordena (drag) y activa/desactiva las preguntas del onboarding (4 tipos).

**Architecture:** Funciones puras testeables (`lib/admin/onboarding-helpers.ts`, TDD) + server actions (`lib/admin/onboardingActions.ts`, RLS admin, patrón `dayActions`) + página server que trae todas las preguntas + client component con lista sortable (dnd-kit, como `BlockListEditor`) y un editor en modal. Sin migración (RLS ya permite escritura admin).

**Tech Stack:** Next.js 14 App Router (server actions), TypeScript, Supabase (RLS admin), @dnd-kit, Vitest, inline styles + CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-06-10-onboarding-builder-design.md`

---

## File Structure

**Crear:**
- `lib/admin/onboarding-helpers.ts` — tipos (`QuestionType`, `QuestionInput`, `OnboardingQuestion`) + `validateQuestion` + `reindexOrder` (puras).
- `lib/admin/onboardingActions.ts` — `saveQuestion`, `reorderQuestions`, `setQuestionActive` (server actions).
- `components/admin/OnboardingQuestionEditor.tsx` — modal editor de una pregunta.
- `components/admin/OnboardingBuilder.tsx` — lista sortable + toggles + orquesta el modal.
- `__tests__/onboarding-helpers.test.ts` — tests TDD de los helpers.

**Modificar:**
- `app/admin/onboarding-settings/page.tsx` — de stub a server component real.

---

### Task 1: Helpers puros + tipos (TDD)

**Files:**
- Create: `lib/admin/onboarding-helpers.ts`
- Create: `__tests__/onboarding-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/onboarding-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateQuestion, reindexOrder, type QuestionInput } from "@/lib/admin/onboarding-helpers";

const base: QuestionInput = {
  question_text: "¿Cuál es tu objetivo?",
  question_type: "single_choice",
  options: ["Bajar de peso", "Tonificar"],
  is_required: true,
};

describe("validateQuestion", () => {
  it("rechaza texto vacío o solo espacios", () => {
    expect(validateQuestion({ ...base, question_text: "   " }).ok).toBe(false);
  });
  it("acepta una pregunta de selección con opciones", () => {
    const r = validateQuestion(base);
    expect(r.ok).toBe(true);
    expect(r.cleanedOptions).toEqual(["Bajar de peso", "Tonificar"]);
  });
  it("trim y dedup de opciones", () => {
    const r = validateQuestion({ ...base, options: ["  A  ", "A", "B", ""] });
    expect(r.cleanedOptions).toEqual(["A", "B"]);
  });
  it("rechaza selección sin opciones válidas", () => {
    expect(validateQuestion({ ...base, options: ["", "   "] }).ok).toBe(false);
    expect(validateQuestion({ ...base, options: null }).ok).toBe(false);
  });
  it("text/number fuerzan cleanedOptions null aunque manden options", () => {
    const r = validateQuestion({ ...base, question_type: "text", options: ["x"] });
    expect(r.ok).toBe(true);
    expect(r.cleanedOptions).toBeNull();
  });
});

describe("reindexOrder", () => {
  it("asigna sort_order = índice", () => {
    expect(reindexOrder(["a", "b", "c"])).toEqual([
      { id: "a", sort_order: 0 }, { id: "b", sort_order: 1 }, { id: "c", sort_order: 2 },
    ]);
  });
  it("lista vacía => []", () => {
    expect(reindexOrder([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- onboarding-helpers`
Expected: FAIL — `Cannot find module '@/lib/admin/onboarding-helpers'`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin/onboarding-helpers.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- onboarding-helpers`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/onboarding-helpers.ts __tests__/onboarding-helpers.test.ts
git commit -m "feat: helpers de onboarding (validateQuestion, reindexOrder) + tipos (TDD)"
```

---

### Task 2: Server actions

**Files:**
- Create: `lib/admin/onboardingActions.ts`

Sin test unitario (tocan Supabase); acceptance = `npx tsc --noEmit` limpio. Patrón de `lib/admin/dayActions.ts`.

- [ ] **Step 1: Write the implementation**

Create `lib/admin/onboardingActions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateQuestion, type QuestionInput } from "./onboarding-helpers";

function revalidate() {
  revalidatePath("/admin/onboarding-settings");
  revalidatePath("/onboarding/questionnaire");
}

export async function saveQuestion(input: QuestionInput): Promise<{ id: string; error?: string }> {
  const v = validateQuestion(input);
  if (!v.ok) return { id: input.id ?? "", error: v.error };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const row = {
    question_text: input.question_text.trim(),
    question_type: input.question_type,
    options: v.cleanedOptions,
    is_required: input.is_required,
  };

  if (input.id) {
    const { error } = await client.from("onboarding_questions").update(row).eq("id", input.id);
    if (error) return { id: input.id, error: error.message };
    revalidate();
    return { id: input.id };
  }

  // Nueva: sort_order = (max actual) + 1, is_active = true.
  const { data: maxRow } = await client
    .from("onboarding_questions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;

  const { data: inserted, error } = await client
    .from("onboarding_questions")
    .insert({ ...row, sort_order: nextOrder, is_active: true })
    .select("id")
    .single();
  if (error) return { id: "", error: error.message };
  revalidate();
  return { id: inserted.id };
}

export async function reorderQuestions(orderedIds: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await client
      .from("onboarding_questions")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }
  revalidate();
  return {};
}

export async function setQuestionActive(id: string, active: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client.from("onboarding_questions").update({ is_active: active }).eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return {};
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/onboardingActions.ts
git commit -m "feat: server actions de onboarding (saveQuestion/reorderQuestions/setQuestionActive)"
```

---

### Task 3: Editor en modal (`OnboardingQuestionEditor`)

**Files:**
- Create: `components/admin/OnboardingQuestionEditor.tsx`

- [ ] **Step 1: Write the component**

Create `components/admin/OnboardingQuestionEditor.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/OnboardingQuestionEditor.tsx
git commit -m "feat: OnboardingQuestionEditor (modal: tipo, opciones, obligatoria)"
```

---

### Task 4: Builder con lista sortable (`OnboardingBuilder`)

**Files:**
- Create: `components/admin/OnboardingBuilder.tsx`

- [ ] **Step 1: Write the component**

Create `components/admin/OnboardingBuilder.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/OnboardingBuilder.tsx
git commit -m "feat: OnboardingBuilder (lista sortable dnd + activar/desactivar + agregar)"
```

---

### Task 5: Página server + verificación final

**Files:**
- Modify: `app/admin/onboarding-settings/page.tsx`

- [ ] **Step 1: Replace the stub with the real page**

Replace the entire contents of `app/admin/onboarding-settings/page.tsx` with:

```tsx
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
```

- [ ] **Step 2: Full verification**

Run: `npm run test:run`
Expected: all green (incluye `onboarding-helpers`).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build limpio; `/admin/onboarding-settings` aparece en el output.
(Nota: si el worktree no tiene `.env.local`, el build falla con `STRIPE_SECRET_KEY is not set` en `/api/webhooks/stripe` — issue de entorno PRE-EXISTENTE, no del código; el controller lo resuelve copiando `.env.local`.)

- [ ] **Step 3: Manual verification (dev server)**

Run `npm run dev` y como admin en `/admin/onboarding-settings`:
1. Agregar pregunta de cada tipo (texto, número, selección única con opciones, selección múltiple); validación bloquea selección sin opciones y texto vacío.
2. Reordenar arrastrando; el orden persiste tras refrescar.
3. Editar una pregunta (texto, tipo, opciones, obligatoria).
4. Desactivar/activar; las inactivas se ven atenuadas con badge "Inactiva".
5. Abrir `/onboarding/questionnaire` (como cliente sin onboarding completo) y confirmar que muestra solo las activas, en el orden definido, con los tipos correctos.

- [ ] **Step 4: Commit**

```bash
git add app/admin/onboarding-settings/page.tsx
git commit -m "feat: /admin/onboarding-settings constructor real (cierra Configuración de Onboarding)"
```

---

## Notas de verificación contra el spec

- **CRUD + reordenar + activar/desactivar** → Tasks 2 (actions), 4 (builder).
- **4 tipos + editor de opciones** → Task 3 (editor).
- **Validación (texto, opciones, trim/dedup, text/number sin opciones)** → Task 1 (TDD) + usada en editor (Task 3) y action (Task 2).
- **Solo desactivar (sin borrado físico)** → `setQuestionActive`; no hay delete.
- **Reordenar drag (dnd-kit)** → Task 4 (`onDragEnd` + `reorderQuestions`).
- **Página server trae activas e inactivas** → Task 5.
- **Cuestionario del cliente sin cambios** (ya filtra `is_active` + ordena) → no se toca.
- **Sin migración** (RLS admin ya existe) → ninguna tarea de DB.
```
