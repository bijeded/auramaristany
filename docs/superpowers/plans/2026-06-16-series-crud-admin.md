# CRUD de Series en Admin de Contenido — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar creación, edición y eliminación de series (meses de contenido) desde `/admin/content/[programId]`, con selección manual de variantes.

**Architecture:** Server actions en `lib/admin/seriesActions.ts` (TDD); modal `SeriesFormModal` reutilizable para crear/editar; diálogo `SeriesDeleteDialog` para confirmar borrado; menú "⋯" integrado en `SeriesAccordion` siguiendo el patrón `DayCellMenu`; botón "Nueva serie" extraído a `NewSeriesButton` (client component) para mantener la página como Server Component.

**Tech Stack:** Next.js 15 App Router, Supabase JS client, Vitest (TDD), Tailwind / CSS vars del proyecto, Lucide React.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `__tests__/series-actions.test.ts` | Crear | Tests unitarios de las 3 server actions |
| `lib/admin/seriesActions.ts` | Crear | `createSeries`, `updateSeries`, `deleteSeries` |
| `lib/admin/queries.ts` | Modificar | Agregar `AdminVariant`, `variantIds` a `AdminSeries`, actualizar `getAdminProgram` |
| `components/admin/SeriesDeleteDialog.tsx` | Crear | Diálogo de confirmación de borrado |
| `components/admin/SeriesFormModal.tsx` | Crear | Modal crear/editar (campos + checkboxes de variantes) |
| `components/admin/NewSeriesButton.tsx` | Crear | Botón "Nueva serie" con estado del modal (client component) |
| `components/admin/SeriesAccordion.tsx` | Modificar | Agregar menú "⋯" con edit/delete, montar modales |
| `app/admin/content/[programId]/page.tsx` | Modificar | Usar `NewSeriesButton`, pasar `variants` a acordeones |

---

## Task 1: Tests para seriesActions (TDD)

**Files:**
- Create: `__tests__/series-actions.test.ts`

- [ ] **Step 1: Escribir los tests (van a fallar — el archivo de implementación aún no existe)**

Crear `__tests__/series-actions.test.ts` con este contenido exacto:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Fake Supabase ──────────────────────────────────────────────────
const calls: { table: string; op: string; payload?: unknown }[] = [];
let insertSeriesError: { code: string; message: string } | null = null;

const fakeSupabase = {
  from: (table: string) => ({
    insert: (payload: unknown) => {
      calls.push({ table, op: "insert", payload });
      if (table === "program_series") {
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: insertSeriesError ? null : { id: "new-series-id" },
                error: insertSeriesError,
              }),
          }),
        };
      }
      // variant_series_map — se await directamente sin .select().single()
      return { error: null };
    },
    update: (payload: unknown) => {
      calls.push({ table, op: "update", payload });
      return { eq: (_col: string, _val: string) => Promise.resolve({ error: null }) };
    },
    delete: () => {
      calls.push({ table, op: "delete" });
      return { eq: (_col: string, _val: string) => Promise.resolve({ error: null }) };
    },
  }),
};

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () => ({
    ok: true,
    supabase: fakeSupabase,
    user: { id: "admin-1" },
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createSeries, updateSeries, deleteSeries } from "@/lib/admin/seriesActions";

beforeEach(() => {
  calls.length = 0;
  insertSeriesError = null;
});

// ─── createSeries ───────────────────────────────────────────────────
describe("createSeries", () => {
  it("inserta la serie y los mappings de variantes", async () => {
    const result = await createSeries("prog-1", {
      series_number: 1,
      title: "Fundamentos",
      description: null,
      variantIds: ["v1", "v2"],
    });
    expect(result.error).toBeUndefined();
    expect(calls.find((c) => c.table === "program_series" && c.op === "insert")).toBeTruthy();
    const mapInsert = calls.find(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    expect(mapInsert).toBeTruthy();
    expect((mapInsert!.payload as unknown[]).length).toBe(2);
  });

  it("retorna error si el número de serie ya existe (código 23505)", async () => {
    insertSeriesError = { code: "23505", message: "unique violation" };
    const result = await createSeries("prog-1", {
      series_number: 1,
      title: "Dup",
      description: null,
      variantIds: ["v1"],
    });
    expect(result.error).toBe("El mes 1 ya existe en este programa");
  });
});

// ─── updateSeries ───────────────────────────────────────────────────
describe("updateSeries", () => {
  it("actualiza los campos de la serie", async () => {
    const result = await updateSeries("series-1", "prog-1", {
      title: "Mes actualizado",
      description: "Nueva desc",
      published: true,
      variantIds: ["v1"],
    });
    expect(result.error).toBeUndefined();
    const upd = calls.find((c) => c.table === "program_series" && c.op === "update");
    expect((upd?.payload as { title: string })?.title).toBe("Mes actualizado");
    expect((upd?.payload as { published: boolean })?.published).toBe(true);
  });

  it("reconcilia variantes: elimina viejos e inserta los nuevos", async () => {
    await updateSeries("series-1", "prog-1", {
      title: "T",
      description: null,
      published: false,
      variantIds: ["v3", "v4"],
    });
    expect(
      calls.find((c) => c.table === "variant_series_map" && c.op === "delete")
    ).toBeTruthy();
    const mapInsert = calls.find(
      (c) => c.table === "variant_series_map" && c.op === "insert"
    );
    expect((mapInsert?.payload as unknown[]).length).toBe(2);
  });
});

// ─── deleteSeries ───────────────────────────────────────────────────
describe("deleteSeries", () => {
  it("elimina la serie de program_series", async () => {
    const result = await deleteSeries("series-1", "prog-1");
    expect(result.error).toBeUndefined();
    expect(
      calls.find((c) => c.table === "program_series" && c.op === "delete")
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Ejecutar los tests — deben fallar con "Cannot find module"**

```bash
npx vitest run __tests__/series-actions.test.ts
```

Resultado esperado: `FAIL` — `Cannot find module '@/lib/admin/seriesActions'`

---

## Task 2: Implementar seriesActions.ts

**Files:**
- Create: `lib/admin/seriesActions.ts`

- [ ] **Step 3: Crear el archivo con las 3 server actions**

Crear `lib/admin/seriesActions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";

export interface CreateSeriesInput {
  series_number: number;
  title: string;
  description?: string | null;
  variantIds: string[];
}

export interface UpdateSeriesInput {
  title: string;
  description?: string | null;
  published: boolean;
  variantIds: string[];
}

export async function createSeries(
  programId: string,
  data: CreateSeriesInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: newSeries, error: seriesError } = await supabase
    .from("program_series")
    .insert({
      program_id: programId,
      series_number: data.series_number,
      title: data.title,
      description: data.description ?? null,
      published: false,
    })
    .select("id")
    .single();

  if (seriesError) {
    if ((seriesError as { code?: string }).code === "23505") {
      return { error: `El mes ${data.series_number} ya existe en este programa` };
    }
    return { error: logAndGeneric("createSeries.insert", seriesError) };
  }

  if (data.variantIds.length > 0) {
    const mappings = data.variantIds.map((vid) => ({
      program_variant_id: vid,
      series_id: (newSeries as { id: string }).id,
    }));
    const { error: mapError } = await supabase
      .from("variant_series_map")
      .insert(mappings);
    if (mapError) return { error: logAndGeneric("createSeries.map", mapError) };
  }

  revalidatePath(`/admin/content/${programId}`);
  return {};
}

export async function updateSeries(
  seriesId: string,
  programId: string,
  data: UpdateSeriesInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;

  const { error: updateError } = await supabase
    .from("program_series")
    .update({
      title: data.title,
      description: data.description ?? null,
      published: data.published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seriesId);

  if (updateError) return { error: logAndGeneric("updateSeries.update", updateError) };

  const { error: deleteMapError } = await supabase
    .from("variant_series_map")
    .delete()
    .eq("series_id", seriesId);

  if (deleteMapError) return { error: logAndGeneric("updateSeries.deleteMap", deleteMapError) };

  if (data.variantIds.length > 0) {
    const mappings = data.variantIds.map((vid) => ({
      program_variant_id: vid,
      series_id: seriesId,
    }));
    const { error: insertMapError } = await supabase
      .from("variant_series_map")
      .insert(mappings);
    if (insertMapError) return { error: logAndGeneric("updateSeries.insertMap", insertMapError) };
  }

  revalidatePath(`/admin/content/${programId}`);
  return {};
}

export async function deleteSeries(
  seriesId: string,
  programId: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;

  const { error } = await supabase
    .from("program_series")
    .delete()
    .eq("id", seriesId);

  if (error) return { error: logAndGeneric("deleteSeries.delete", error) };

  revalidatePath(`/admin/content/${programId}`);
  return {};
}
```

- [ ] **Step 4: Ejecutar los tests — deben pasar todos**

```bash
npx vitest run __tests__/series-actions.test.ts
```

Resultado esperado: `5 tests passed`

- [ ] **Step 5: Ejecutar la suite completa para verificar que no hay regresiones**

```bash
npx vitest run
```

Resultado esperado: todos los tests previos siguen en verde.

- [ ] **Step 6: Commit**

```bash
git add __tests__/series-actions.test.ts lib/admin/seriesActions.ts
git commit -m "feat(series): server actions createSeries / updateSeries / deleteSeries + tests"
```

---

## Task 3: Actualizar queries.ts

**Files:**
- Modify: `lib/admin/queries.ts`

- [ ] **Step 7: Agregar `AdminVariant` interface y `variantIds` a `AdminSeries`**

En `lib/admin/queries.ts`, reemplazar el bloque de interfaces `AdminDay` + `AdminSeries` (líneas 19–36) con:

```typescript
export interface AdminDay {
  id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  day_type: string;
  published: boolean;
}

export interface AdminVariant {
  id: string;
  name: string;
}

export interface AdminSeries {
  id: string;
  series_number: number;
  title: string;
  description: string | null;
  published: boolean;
  days: AdminDay[];
  variantIds: string[];
}
```

- [ ] **Step 8: Actualizar `getAdminProgram` para devolver `variants` y poblar `variantIds` por serie**

Reemplazar la función `getAdminProgram` completa (líneas 64–99) con:

```typescript
export async function getAdminProgram(programId: string) {
  const supabase = await createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, slug, name, billing_model, duration_months, is_active")
    .eq("id", programId)
    .single();

  if (!program) return null;

  const { data: rawSeries } = await supabase
    .from("program_series")
    .select(
      "id, series_number, title, description, published, program_days(id, week_number, day_of_week, workout_focus, title, day_type, published)"
    )
    .eq("program_id", programId)
    .order("series_number");

  const { data: rawVariants } = await supabase
    .from("program_variants")
    .select("id, name")
    .eq("program_id", programId)
    .order("name");

  const seriesIds = (rawSeries ?? []).map((s) => s.id);
  const { data: rawMappings } = seriesIds.length > 0
    ? await supabase
        .from("variant_series_map")
        .select("series_id, program_variant_id")
        .in("series_id", seriesIds)
    : { data: [] as { series_id: string; program_variant_id: string }[] };

  const variantMap: Record<string, string[]> = {};
  for (const m of (rawMappings ?? []) as { series_id: string; program_variant_id: string }[]) {
    if (!variantMap[m.series_id]) variantMap[m.series_id] = [];
    variantMap[m.series_id].push(m.program_variant_id);
  }

  type RawSeries = Omit<AdminSeries, "days" | "variantIds"> & {
    program_days: AdminDay[];
  };

  // keep: program_series JOIN program_days (nested collection) — join shape not inferred.
  const series: AdminSeries[] = ((rawSeries ?? []) as RawSeries[]).map((s) => ({
    id: s.id,
    series_number: s.series_number,
    title: s.title,
    description: s.description,
    published: s.published,
    days: s.program_days ?? [],
    variantIds: variantMap[s.id] ?? [],
  }));

  // SDK types the simple selects; cast to local interfaces.
  const variants: AdminVariant[] = (rawVariants ?? []) as AdminVariant[];

  return { program: program as Omit<AdminProgram, "series_count">, series, variants };
}
```

- [ ] **Step 9: Verificar que los tests siguen pasando (el cambio de tipo debe ser retrocompatible)**

```bash
npx vitest run
```

Resultado esperado: todos en verde.

- [ ] **Step 10: Commit**

```bash
git add lib/admin/queries.ts
git commit -m "feat(series): getAdminProgram devuelve variants + variantIds por serie"
```

---

## Task 4: SeriesDeleteDialog

**Files:**
- Create: `components/admin/SeriesDeleteDialog.tsx`

- [ ] **Step 11: Crear el componente**

Crear `components/admin/SeriesDeleteDialog.tsx`:

```tsx
"use client";

interface Props {
  series: { series_number: number; title: string };
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string;
}

export function SeriesDeleteDialog({ series, onClose, onConfirm, loading, error }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        <h2 className="font-head" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          ¿Eliminar Mes {series.series_number}?
        </h2>
        <p className="font-body" style={{ fontSize: 14, color: "var(--gris-texto)", marginBottom: 20 }}>
          <strong>{series.title}</strong> y todo su contenido (días, bloques y pilares) se
          eliminarán permanentemente. Esta acción no se puede deshacer.
        </p>
        {error && (
          <p className="font-body mb-4" style={{ fontSize: 13, color: "#e05c5c" }}>{error}</p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="font-body rounded-xl px-4 py-2"
            style={{
              fontSize: 13, fontWeight: 600,
              background: "#f0f0f0", color: "var(--gris-texto)", border: "none",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="font-body rounded-xl px-4 py-2"
            style={{
              fontSize: 13, fontWeight: 600,
              background: "#e05c5c", color: "#fff", border: "none",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Commit**

```bash
git add components/admin/SeriesDeleteDialog.tsx
git commit -m "feat(series): SeriesDeleteDialog — confirmación de borrado con cascade warning"
```

---

## Task 5: SeriesFormModal

**Files:**
- Create: `components/admin/SeriesFormModal.tsx`

- [ ] **Step 13: Crear el componente**

Crear `components/admin/SeriesFormModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createSeries, updateSeries } from "@/lib/admin/seriesActions";
import type { AdminVariant, AdminSeries } from "@/lib/admin/queries";

interface Props {
  programId: string;
  variants: AdminVariant[];
  mode: "create" | "edit";
  series?: Pick<
    AdminSeries,
    "id" | "series_number" | "title" | "description" | "published" | "variantIds"
  >;
  onClose: () => void;
}

export function SeriesFormModal({ programId, variants, mode, series, onClose }: Props) {
  const [title, setTitle] = useState(series?.title ?? "");
  const [description, setDescription] = useState(series?.description ?? "");
  const [seriesNumber, setSeriesNumber] = useState<number | "">(series?.series_number ?? "");
  const [published, setPublished] = useState(series?.published ?? false);
  const [selectedVariants, setSelectedVariants] = useState<string[]>(
    series?.variantIds ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function toggleVariant(id: string) {
    setSelectedVariants((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    if (!title.trim()) { setError("El título es requerido."); return; }
    if (selectedVariants.length === 0) { setError("Selecciona al menos una variante."); return; }
    if (mode === "create" && !seriesNumber) { setError("El número de mes es requerido."); return; }

    setLoading(true);

    if (mode === "create") {
      const res = await createSeries(programId, {
        series_number: Number(seriesNumber),
        title: title.trim(),
        description: description.trim() || null,
        variantIds: selectedVariants,
      });
      if (res.error) {
        if (res.error.includes("ya existe")) setFieldError(res.error);
        else setError(res.error);
        setLoading(false);
        return;
      }
    } else {
      const res = await updateSeries(series!.id, programId, {
        title: title.trim(),
        description: description.trim() || null,
        published,
        variantIds: selectedVariants,
      });
      if (res.error) { setError(res.error); setLoading(false); return; }
    }

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}
      >
        <h2 className="font-head mb-5" style={{ fontSize: 20, fontWeight: 700 }}>
          {mode === "create" ? "Nueva serie" : `Editar Mes ${series!.series_number}`}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "create" && (
            <div>
              <label className="font-body block mb-1" style={{ fontSize: 13, fontWeight: 600 }}>
                Mes #
              </label>
              <input
                type="number"
                min={1}
                value={seriesNumber}
                onChange={(e) => {
                  setSeriesNumber(e.target.value === "" ? "" : Number(e.target.value));
                  setFieldError(null);
                }}
                className="font-body w-full rounded-xl px-3 py-2"
                style={{
                  fontSize: 14,
                  border: `1.5px solid ${fieldError ? "#e05c5c" : "var(--gris-linea)"}`,
                }}
                required
              />
              {fieldError && (
                <p className="font-body mt-1" style={{ fontSize: 12, color: "#e05c5c" }}>
                  {fieldError}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="font-body block mb-1" style={{ fontSize: 13, fontWeight: 600 }}>
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-body w-full rounded-xl px-3 py-2"
              style={{ fontSize: 14, border: "1.5px solid var(--gris-linea)" }}
              required
            />
          </div>

          <div>
            <label className="font-body block mb-1" style={{ fontSize: 13, fontWeight: 600 }}>
              Descripción{" "}
              <span style={{ fontWeight: 400, color: "var(--gris-texto)" }}>(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="font-body w-full rounded-xl px-3 py-2"
              style={{ fontSize: 14, border: "1.5px solid var(--gris-linea)", resize: "vertical" }}
            />
          </div>

          {mode === "edit" && (
            <label
              className="flex items-center gap-2 cursor-pointer font-body"
              style={{ fontSize: 14 }}
            >
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Publicado
            </label>
          )}

          <div>
            <p className="font-body mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
              Variantes
            </p>
            <div className="flex flex-col gap-2">
              {variants.map((v) => (
                <label
                  key={v.id}
                  className="flex items-center gap-2 cursor-pointer font-body"
                  style={{ fontSize: 14 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedVariants.includes(v.id)}
                    onChange={() => toggleVariant(v.id)}
                    className="w-4 h-4 rounded"
                  />
                  {v.name}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="font-body" style={{ fontSize: 13, color: "#e05c5c" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="font-body rounded-xl px-4 py-2"
              style={{
                fontSize: 13, fontWeight: 600,
                background: "#f0f0f0", color: "var(--gris-texto)", border: "none",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="font-body rounded-xl px-4 py-2"
              style={{
                fontSize: 13, fontWeight: 600,
                background: "var(--lavanda-dark)", color: "#fff", border: "none",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? "Guardando…"
                : mode === "create"
                ? "Crear serie"
                : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 14: Commit**

```bash
git add components/admin/SeriesFormModal.tsx
git commit -m "feat(series): SeriesFormModal — modal crear/editar con checkboxes de variantes"
```

---

## Task 6: NewSeriesButton

**Files:**
- Create: `components/admin/NewSeriesButton.tsx`

- [ ] **Step 15: Crear el componente**

Crear `components/admin/NewSeriesButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { SeriesFormModal } from "./SeriesFormModal";
import type { AdminVariant } from "@/lib/admin/queries";

interface Props {
  programId: string;
  variants: AdminVariant[];
}

export function NewSeriesButton({ programId, variants }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 font-body rounded-xl px-4 py-2"
        style={{
          fontSize: 13,
          fontWeight: 600,
          background: "var(--lavanda-tint)",
          color: "var(--lavanda-dark)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <PlusCircle size={16} />
        Nueva serie
      </button>
      {open && (
        <SeriesFormModal
          programId={programId}
          variants={variants}
          mode="create"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 16: Commit**

```bash
git add components/admin/NewSeriesButton.tsx
git commit -m "feat(series): NewSeriesButton — client component para abrir modal de creación"
```

---

## Task 7: Actualizar SeriesAccordion

**Files:**
- Modify: `components/admin/SeriesAccordion.tsx`

- [ ] **Step 17: Reemplazar el archivo completo**

El header original es un `<button>` único; anidar otro `<button>` dentro es HTML inválido, así que se reestructura: el header se convierte en un `<div>` flex y solo la sección de info queda como `<button>` expandible.

Reemplazar `components/admin/SeriesAccordion.tsx` con:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Layers, MoreVertical } from "lucide-react";
import { WeeklyGrid } from "./WeeklyGrid";
import { SeriesFormModal } from "./SeriesFormModal";
import { SeriesDeleteDialog } from "./SeriesDeleteDialog";
import { deleteSeries } from "@/lib/admin/seriesActions";
import type { AdminSeries, AdminVariant } from "@/lib/admin/queries";

interface Props {
  series: AdminSeries;
  programId: string;
  programSlug?: string;
  defaultOpen?: boolean;
  variants: AdminVariant[];
}

export function SeriesAccordion({
  series,
  programId,
  programSlug,
  defaultOpen = false,
  variants,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(undefined);
    const { error } = await deleteSeries(series.id, programId);
    setDeleteLoading(false);
    if (error) { setDeleteError(error); return; }
    setModal(null);
  }

  const publishedCount = series.days.filter((d) => d.published).length;
  const draftCount = series.days.filter((d) => !d.published).length;

  return (
    <>
      <div
        className="rounded-xl bg-white overflow-hidden"
        style={{ border: "1.5px solid var(--gris-linea)", boxShadow: "var(--shadow-card)" }}
      >
        {/* Header — div flex para poder anidar ambos botones */}
        <div className="flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-3 flex-1 text-left"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <div
              className="flex items-center justify-center rounded-lg font-head flex-shrink-0"
              style={{
                width: 36, height: 36,
                background: series.published ? "var(--lavanda-tint)" : "#f0f0f0",
                color: series.published ? "var(--lavanda-dark)" : "var(--gris-texto)",
                fontSize: 15, fontWeight: 700,
              }}
            >
              {series.series_number}
            </div>
            <div>
              <p className="font-head" style={{ fontSize: 15, fontWeight: 600, color: "var(--negro)" }}>
                Mes {series.series_number}{series.title ? ` — ${series.title}` : ""}
              </p>
              <p className="font-body" style={{ fontSize: 12, color: "var(--gris-texto)", marginTop: 2 }}>
                {publishedCount > 0 && (
                  <span style={{ color: "var(--lavanda-dark)", fontWeight: 600 }}>
                    {publishedCount} publicado{publishedCount !== 1 ? "s" : ""}
                  </span>
                )}
                {publishedCount > 0 && draftCount > 0 && " · "}
                {draftCount > 0 && `${draftCount} borrador${draftCount !== 1 ? "es" : ""}`}
                {publishedCount === 0 && draftCount === 0 && "Sin días creados"}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!series.published && (
              <span
                className="font-body rounded-full px-2.5 py-1"
                style={{ fontSize: 10.5, fontWeight: 600, background: "#f0f0f0", color: "var(--gris-texto)" }}
              >
                borrador
              </span>
            )}
            {/* Menú ⋯ */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--gris-texto)", padding: "4px",
                }}
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div
                  className="absolute z-10 right-0 mt-1 rounded-lg border bg-white shadow-md font-body"
                  style={{ borderColor: "var(--gris-linea)", fontSize: 13 }}
                >
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setModal("edit"); }}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setModal("delete"); }}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap"
                    style={{ color: "#e05c5c" }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
            {open ? (
              <ChevronUp size={18} color="var(--gris-suave)" />
            ) : (
              <ChevronDown size={18} color="var(--gris-suave)" />
            )}
          </div>
        </div>

        {/* Contenido expandido */}
        {open && (
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ borderTop: "1px solid var(--gris-linea)", paddingTop: 16 }}>
              {(programSlug === "cuarenta-mas" || programSlug === "cuarenta-mas-extra") && (
                <div className="mb-3">
                  <Link
                    href={`/admin/content/${programId}/series/${series.id}/pillars`}
                    className="inline-flex items-center gap-1.5 font-body rounded-lg px-3 py-1.5"
                    style={{
                      fontSize: 13, fontWeight: 600,
                      background: "var(--lavanda-soft)", color: "var(--lavanda-dark)",
                      border: "1px solid var(--lavanda-soft)",
                    }}
                  >
                    <Layers size={14} /> Pilares del mes
                  </Link>
                </div>
              )}
              <WeeklyGrid days={series.days} programId={programId} seriesId={series.id} />
            </div>
          </div>
        )}
      </div>

      {modal === "edit" && (
        <SeriesFormModal
          programId={programId}
          variants={variants}
          mode="edit"
          series={series}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "delete" && (
        <SeriesDeleteDialog
          series={series}
          onClose={() => { setModal(null); setDeleteError(undefined); }}
          onConfirm={handleDelete}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </>
  );
}
```

- [ ] **Step 18: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores (o solo errores preexistentes no relacionados a estos archivos).

- [ ] **Step 19: Commit**

```bash
git add components/admin/SeriesAccordion.tsx
git commit -m "feat(series): SeriesAccordion — menú ⋯ con editar/eliminar"
```

---

## Task 8: Actualizar [programId]/page.tsx

**Files:**
- Modify: `app/admin/content/[programId]/page.tsx`

- [ ] **Step 20: Reemplazar el archivo completo**

Reemplazar `app/admin/content/[programId]/page.tsx` con:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getAdminProgram } from "@/lib/admin/queries";
import { SeriesAccordion } from "@/components/admin/SeriesAccordion";
import { NewSeriesButton } from "@/components/admin/NewSeriesButton";

export default async function AdminProgramPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const result = await getAdminProgram(programId);

  if (!result) notFound();

  const { program, series, variants } = result;

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-2 mb-6 font-body"
        style={{ fontSize: 13, color: "var(--gris-suave)" }}
      >
        <Link href="/admin/content" style={{ color: "var(--gris-suave)", textDecoration: "none" }}>
          Contenido
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: "var(--negro)", fontWeight: 600 }}>{program.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>
            {program.name}
          </h1>
          <p className="font-body mt-1" style={{ fontSize: 14, color: "var(--gris-texto)" }}>
            {series.length} {series.length === 1 ? "serie" : "series"} ·{" "}
            {program.duration_months
              ? `${program.duration_months} meses de contenido`
              : "Programa continuo"}
          </p>
        </div>
        <NewSeriesButton programId={programId} variants={variants} />
      </div>

      {/* Lista de series */}
      {series.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ border: "1.5px dashed var(--gris-linea)", background: "#fff" }}
        >
          <p className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Sin series todavía
          </p>
          <p className="font-body" style={{ fontSize: 14, color: "var(--gris-texto)" }}>
            Crea la primera serie para empezar a cargar contenido.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {series.map((s, i) => (
            <SeriesAccordion
              key={s.id}
              series={s}
              programId={programId}
              programSlug={program.slug}
              variants={variants}
              defaultOpen={i === series.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 21: Ejecutar la suite de tests completa**

```bash
npx vitest run
```

Resultado esperado: todos los tests en verde.

- [ ] **Step 22: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores nuevos.

- [ ] **Step 23: Commit**

```bash
git add app/admin/content/\[programId\]/page.tsx
git commit -m "feat(series): habilitar botón Nueva serie + pasar variants a SeriesAccordion"
```

---

## Task 9: Smoke test manual

- [ ] **Step 24: Arrancar el servidor de desarrollo**

```bash
npm run dev
```

- [ ] **Step 25: Verificar flujo crear serie**

1. Ir a `http://localhost:3000/admin/content`
2. Entrar a **CuarentaMás**
3. Hacer clic en **"Nueva serie"** — debe abrirse el modal
4. Llenar: Mes # = `1`, Título = `Fundamentos de movimiento`, seleccionar al menos una variante
5. Hacer clic en **"Crear serie"** — el modal debe cerrarse y aparecer la serie en la lista

- [ ] **Step 26: Verificar flujo editar serie**

1. En la serie recién creada, hacer clic en **⋯ → Editar**
2. Cambiar el título y marcar **Publicado**
3. Guardar — el badge "borrador" debe desaparecer del accordion

- [ ] **Step 27: Verificar flujo mes duplicado**

1. Intentar crear otra serie con el mismo número (1)
2. Debe aparecer el error **"El mes 1 ya existe en este programa"** bajo el campo "Mes #"

- [ ] **Step 28: Verificar flujo eliminar serie**

1. Abrir **⋯ → Eliminar** en la serie
2. Confirmar en el diálogo
3. La serie debe desaparecer de la lista

- [ ] **Step 29: Commit final de smoke**

Si todo funciona sin ajustes:

```bash
git add -A
git status  # verificar que no haya archivos no deseados
git commit -m "feat(series): CRUD completo de series en admin — crear, editar, eliminar con mapeo de variantes"
```
