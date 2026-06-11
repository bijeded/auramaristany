# Diseño — Constructor de Formulario de Onboarding (`/admin/onboarding-settings`) · Fase 6

**Fecha:** 10 de junio de 2026
**Fase:** 6 (Pulido + Launch), sub-bloque 4b
**Estado de partida:** `/admin/onboarding-settings` es un **stub**. El cuestionario del cliente (`/onboarding/questionnaire`) ya es dinámico: lee `onboarding_questions` activas ordenadas por `sort_order` y guarda en `onboarding_responses.responses` (jsonb). RLS ya permite escritura admin sobre `onboarding_questions` (`onboarding_questions_admin_write for all using (is_admin())`) — **no hace falta migración**.

## Objetivo

Que Aura (admin) gestione las preguntas del onboarding: crear, editar, reordenar y activar/desactivar, con los 4 tipos (texto libre, número, selección única, selección múltiple). Es la "Configuración de Onboarding" del SPEC.

## Enfoque

Lista **sortable** (dnd-kit, como `BlockListEditor`) para reordenar, + **editor en modal** para crear/editar una pregunta y sus opciones. Mantener el drag simple (la edición no vive dentro de la fila arrastrable). Server actions con `createClient()` (RLS admin) + `revalidatePath`, patrón de `lib/admin/dayActions.ts`.

---

## 1. Rutas y archivos

- **`app/admin/onboarding-settings/page.tsx`** (hoy stub) → server component: trae TODAS las preguntas (activas e inactivas) ordenadas por `sort_order`, renderiza `<OnboardingBuilder questions={...} />`.
- **`components/admin/OnboardingBuilder.tsx`** — client: lista sortable de preguntas (drag handle, resumen, badges de tipo/obligatoria, toggle activar/desactivar, botón "Editar"); botón "+ Agregar pregunta"; orquesta el modal editor; persiste vía server actions + `router.refresh()`.
- **`components/admin/OnboardingQuestionEditor.tsx`** — client: modal con campos `question_text` (input), `question_type` (select de 4), `is_required` (checkbox), y para tipos de selección un **editor de opciones** (lista de inputs de texto, agregar/quitar). Valida con `validateQuestion` antes de llamar `saveQuestion`.
- **`lib/admin/onboardingActions.ts`** — server actions ("use server"):
  - `saveQuestion(input): Promise<{ id: string; error?: string }>` — crea o edita. En crear: `sort_order = (max actual) + 1`, `is_active = true`.
  - `reorderQuestions(orderedIds: string[]): Promise<{ error?: string }>` — set `sort_order = índice` para cada id.
  - `setQuestionActive(id: string, active: boolean): Promise<{ error?: string }>`.
  - Todas: `createClient()` + `(supabase as any)` (patrón existente) + `revalidatePath("/admin/onboarding-settings")` y `revalidatePath("/onboarding/questionnaire")`.
- **`lib/admin/onboarding-helpers.ts`** — funciones puras (TDD): `validateQuestion`, `reindexOrder`.

---

## 2. Modelo de datos (sin cambios de schema)

`onboarding_questions`: `id uuid`, `sort_order int`, `question_text text`, `question_type text check ('text'|'number'|'single_choice'|'multi_choice')`, `options jsonb` (array de strings solo en tipos de selección; `null` en text/number), `is_required bool`, `is_active bool`.

### Tipos / firmas (helpers)

```
type QuestionType = "text" | "number" | "single_choice" | "multi_choice";

interface QuestionInput {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
}

validateQuestion(input): { ok: boolean; error?: string; cleanedOptions: string[] | null }
  - question_text trim no vacío (si no → error).
  - single_choice/multi_choice: cleanedOptions = options trim, sin vacíos, dedup; requiere ≥1 (si no → error).
  - text/number: cleanedOptions = null (ignora cualquier options).

reindexOrder(orderedIds): { id: string; sort_order: number }[]  // sort_order = índice
```

---

## 3. Comportamiento

- **Reordenar:** drag (dnd-kit `DndContext`/`SortableContext`/`useSortable`, `GripVertical` handle) → `arrayMove` local (optimista) → `reorderQuestions(ids)` → `router.refresh()`. Solo se reordenan entre sí; inactivas también participan del orden.
- **Crear:** "+ Agregar pregunta" abre el modal vacío. Al guardar: `validateQuestion` → `saveQuestion` (sort_order = max+1, is_active=true).
- **Editar:** "Editar" abre el modal con los valores actuales → `saveQuestion` con `id`.
- **Activar/desactivar:** toggle por fila → `setQuestionActive`. Inactivas se ven atenuadas en el builder con etiqueta "Inactiva"; NO aparecen en `/onboarding/questionnaire` (que ya filtra `is_active=true`).
- **Editor de opciones (modal):** visible solo para `single_choice`/`multi_choice`; lista de inputs con "+ Agregar opción" y quitar por opción. Al cambiar a text/number, las opciones se descartan (`options=null`).
- El **cuestionario del cliente** no cambia: ya lee activas ordenadas y refleja la configuración.

---

## 4. Edge cases

- **Cambiar el tipo de una pregunta con respuestas históricas:** permitido (las respuestas viven en jsonb por id; el `question_text` es solo display en la ficha). El editor muestra un aviso suave de que el cambio afecta cómo se interpretan respuestas previas.
- **Tipo de selección sin opciones:** `validateQuestion` bloquea el guardado con mensaje claro.
- **Reordenar no es transaccional** (varios UPDATE de `sort_order`): aceptable single-admin (mismo caveat que `saveBlocks`).
- **Lista vacía:** estado vacío con CTA "+ Agregar pregunta".
- **`options` con duplicados o espacios:** `validateQuestion` hace trim + dedup antes de guardar.

---

## 5. Testing

- **TDD** de `lib/admin/onboarding-helpers.ts`:
  - `validateQuestion`: texto vacío → error; single/multi sin opciones → error; trim/dedup de opciones; text/number fuerzan `options=null`; caso válido.
  - `reindexOrder`: asigna `sort_order` = índice; lista vacía.
- Server actions sin unit test (tocan Supabase) — validadas por build + smoke.
- Verificación: `npm run test:run` + `npx tsc --noEmit` + `npm run build` limpios.
- **Smoke manual:** crear pregunta de cada tipo → reordenar (drag) → editar → desactivar → abrir `/onboarding/questionnaire` y confirmar que refleja activas en el orden definido (y oculta las inactivas).

---

## 6. Fuera de alcance (follow-ups)

- **Teléfono obligatorio en `/auth/register`** → `profiles.phone` (decisión del usuario; sub-bloque aparte que activa el botón WhatsApp admin→cliente, hoy inactivo porque `phone` casi siempre es null).
- **Borrado físico** de preguntas (se eligió solo desactivar para no dejar respuestas huérfanas en el jsonb).
- Preview en vivo dentro del builder (el `/onboarding/questionnaire` real sirve de preview).
- Reordenar opciones dentro de una pregunta vía drag (por ahora agregar/quitar basta; el orden es el de inserción).

Ver [[project_aura]], [[feedback_project_approach]].
