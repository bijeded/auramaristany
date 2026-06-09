# Fase 3 — Historial (`/portal/history`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `/portal/history` ("Mi Progreso") con 2 tabs (Desempeño con gráficas Recharts + lista de días; Fotos privadas) y la vista de detalle read-only `/portal/history/[logId]`.

**Architecture:** Server components cargan datos vía un nuevo `lib/content/history.ts` (patrón de `getTodayContent`), apoyado en funciones puras testeables (`lib/content/history-helpers.ts`). Las fotos viven en un bucket privado `progress` con signed URLs; upload/borrado por endpoints propios del cliente con validación pura (`lib/portal/photo-validation.ts`) y compresión en cliente. El detalle reusa `BlockView` con un componente nuevo `ExerciseListLogged`.

**Tech Stack:** Next.js 14 (App Router) · Supabase (Postgres + RLS + Storage) · Recharts · TypeScript · Vitest.

**Rama:** `feature/fase-3-historial` (ya creada; el diseño está commiteado ahí).

**Decisiones del diseño (fuera de alcance):** sin métricas corporales, sin stat cards, sin selector de periodo, detalle solo lectura, fotos con comentario (no ángulo) y filtro por mes. Ver `docs/superpowers/specs/2026-06-09-fase-3-historial-design.md`.

---

## File Structure

**Nuevos:**
- `lib/content/history-helpers.ts` — funciones puras: `countCompleted`, `countExercisesInBlocks`, `aggregateDayValue`, `buildPerformanceSeries`.
- `lib/content/history.ts` — server-only: `getHistoryList`, `getPerformanceData`, `getHistoryLog`.
- `lib/portal/photo-validation.ts` — puras: `validatePhotoUpload`, `computeResizedDimensions` + constantes.
- `lib/portal/photo-compress.ts` — `"use client"`: compresión canvas (usa `computeResizedDimensions`).
- `supabase/migrations/005_progress_photos.sql` — bucket privado + policies + `caption`.
- `app/api/portal/photos/route.ts` — `POST` (upload).
- `app/api/portal/photos/[id]/route.ts` — `DELETE`.
- `app/portal/history/page.tsx` — server: carga datos + signed URLs, monta `ProgressView`.
- `app/portal/history/[logId]/page.tsx` — server: detalle read-only.
- `components/portal/ProgressView.tsx` — tabs (cliente).
- `components/portal/PerformanceTab.tsx` — gráfica + lista (cliente).
- `components/portal/PerformanceChart.tsx` — Recharts (cliente).
- `components/portal/PhotosTab.tsx` — grid + filtro mes + subir + visor + borrar (cliente).
- `components/portal/HistoryDayView.tsx` — render read-only del día (cliente).
- `components/portal/blocks/ExerciseListLogged.tsx` — ejercicios con valores registrados (cliente).
- `__tests__/history-helpers.test.ts`, `__tests__/photo-validation.test.ts`.

**Modificados:**
- `components/portal/blocks/BlockView.tsx` — prop opcional `loggedExercises`.
- `package.json` — dependencia `recharts`.

---

## Task 1: Dependencia Recharts + migración de fotos

**Files:**
- Modify: `package.json` (vía npm)
- Create: `supabase/migrations/005_progress_photos.sql`

- [ ] **Step 1: Instalar recharts**

Run: `npm install recharts`
Expected: `recharts` aparece en `dependencies` de `package.json`, instala sin errores.

- [ ] **Step 2: Escribir la migración 005**

Create `supabase/migrations/005_progress_photos.sql`:

```sql
-- supabase/migrations/005_progress_photos.sql
-- Fase 3: fotos de progreso privadas + comentario.

-- 1. Comentario libre por foto (reemplaza el uso de 'angle', que queda sin uso).
alter table progress_photos add column if not exists caption text;

-- 2. Bucket privado para fotos de progreso (NO público, a diferencia de 'content').
insert into storage.buckets (id, name, public)
values ('progress', 'progress', false)
on conflict (id) do nothing;

-- 3. RLS de Storage para el bucket 'progress'.
--    La clienta solo accede a objetos bajo su propio prefijo {profile_id}/...
--    (el primer segmento del path es su uid). Admin ve todo.
create policy "progress_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

create policy "progress_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "progress_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

-- 4. progress_photos ya tiene RLS own_or_admin en 001. Confirmar/crear por si falta.
--    (Idempotente: drop + create.)
drop policy if exists "progress_photos_own_or_admin" on progress_photos;
create policy "progress_photos_own_or_admin"
  on progress_photos for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());
```

- [ ] **Step 3: Verificar que 001 define `is_admin()` y RLS de progress_photos**

Run: `grep -n "is_admin\|progress_photos" supabase/migrations/001_initial_schema.sql`
Expected: aparece la función `is_admin()` y la tabla/policy de `progress_photos`. Si la policy ya existe con otro nombre, ajustar el `drop policy if exists` en Step 2 para no duplicar. (Si 001 no tenía policy con ese nombre, el `drop if exists` es inocuo.)

- [ ] **Step 4: Aplicar la migración en Supabase**

La migración se aplica manualmente en el SQL editor del proyecto Supabase (`bgvxaagfnzvzamtxqbkg`), igual que las anteriores. Pegar el contenido de `005_progress_photos.sql` y ejecutar.
Expected: sin errores; el bucket `progress` aparece en Storage como privado.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json supabase/migrations/005_progress_photos.sql
git commit -m "feat(fase-3): recharts + migración fotos de progreso (bucket privado)"
```

---

## Task 2: Funciones puras de agregación (`history-helpers.ts`)

**Files:**
- Create: `lib/content/history-helpers.ts`
- Test: `__tests__/history-helpers.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `__tests__/history-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  countCompleted,
  countExercisesInBlocks,
  aggregateDayValue,
  buildPerformanceSeries,
  type ExerciseMeta,
  type LogForPerf,
} from "@/lib/content/history-helpers";

describe("countCompleted", () => {
  it("returns 0 for null/empty", () => {
    expect(countCompleted(null)).toBe(0);
    expect(countCompleted({})).toBe(0);
  });
  it("counts only entries with completed === true", () => {
    const done = {
      a: { completed: true, series: [] },
      b: { completed: false, series: [] },
      c: { completed: true, series: [] },
    };
    expect(countCompleted(done)).toBe(2);
  });
});

describe("countExercisesInBlocks", () => {
  it("sums exercises across exercise_list blocks only", () => {
    const blocks = [
      { block_type: "text", content: { html: "x" } },
      { block_type: "exercise_list", content: { exercises: [{ id: "1" }, { id: "2" }] } },
      { block_type: "exercise_list", content: { exercises: [{ id: "3" }] } },
    ];
    expect(countExercisesInBlocks(blocks)).toBe(3);
  });
  it("returns 0 when no exercise blocks", () => {
    expect(countExercisesInBlocks([{ block_type: "text", content: {} }])).toBe(0);
  });
});

describe("aggregateDayValue", () => {
  it("returns null for empty series or no numeric values", () => {
    expect(aggregateDayValue([], "weight_kg")).toBeNull();
    expect(aggregateDayValue([{ weight_kg: null }], "weight_kg")).toBeNull();
  });
  it("sums reps_done across series", () => {
    expect(aggregateDayValue([{ reps_done: 10 }, { reps_done: 12 }], "reps_done")).toBe(22);
  });
  it("averages weight_kg across series (2 decimals)", () => {
    expect(aggregateDayValue([{ weight_kg: 10 }, { weight_kg: 15 }], "weight_kg")).toBe(12.5);
  });
  it("ignores null entries when averaging", () => {
    expect(aggregateDayValue([{ weight_kg: 10 }, { weight_kg: null }], "weight_kg")).toBe(10);
  });
});

describe("buildPerformanceSeries", () => {
  const meta = new Map<string, ExerciseMeta>([
    ["ex1", { name: "Sentadilla", metrics: ["reps_done", "weight_kg"] }],
  ]);
  it("builds points per exercise sorted by date", () => {
    const logs: LogForPerf[] = [
      { logDate: "2026-06-05", exercisesDone: { ex1: { completed: true, series: [{ reps_done: 10, weight_kg: 20 }] } } },
      { logDate: "2026-06-01", exercisesDone: { ex1: { completed: true, series: [{ reps_done: 8, weight_kg: 15 }] } } },
    ];
    const result = buildPerformanceSeries(logs, meta);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Sentadilla");
    expect(result[0].points.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-05"]);
    expect(result[0].points[1].values.weight_kg).toBe(20);
  });
  it("skips exercises not present in meta (not in current month defs)", () => {
    const logs: LogForPerf[] = [
      { logDate: "2026-06-01", exercisesDone: { unknown: { completed: true, series: [{ reps_done: 5 }] } } },
    ];
    expect(buildPerformanceSeries(logs, meta)).toEqual([]);
  });
  it("omits days with no numeric value for any metric", () => {
    const logs: LogForPerf[] = [
      { logDate: "2026-06-01", exercisesDone: { ex1: { completed: false, series: [{ reps_done: null, weight_kg: null }] } } },
    ];
    expect(buildPerformanceSeries(logs, meta)[0]?.points ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:run -- __tests__/history-helpers.test.ts`
Expected: FAIL — "Cannot find module '@/lib/content/history-helpers'".

- [ ] **Step 3: Implementar `history-helpers.ts`**

Create `lib/content/history-helpers.ts`:

```ts
// Funciones puras para el historial y las gráficas de desempeño.
// Sin acceso a DB: 100% testeables.

export interface SeriesEntry {
  reps_done?: number | null;
  weight_kg?: number | null;
  [metric: string]: number | null | undefined;
}

export interface ExerciseDoneEntry {
  completed?: boolean;
  series?: SeriesEntry[];
}

export type ExercisesDone = Record<string, ExerciseDoneEntry>;

export interface ExerciseMeta {
  name: string;
  metrics: string[];
}

export interface LogForPerf {
  logDate: string; // "YYYY-MM-DD"
  exercisesDone: ExercisesDone | null;
}

export interface PerfPoint {
  date: string;
  values: Record<string, number | null>;
}

export interface PerfExercise {
  exerciseId: string;
  name: string;
  metrics: string[];
  points: PerfPoint[];
}

// Métricas que se suman a lo largo del día; el resto se promedian.
const SUM_METRICS = new Set(["reps_done"]);

export function countCompleted(done: ExercisesDone | null | undefined): number {
  if (!done) return 0;
  return Object.values(done).filter((e) => e?.completed === true).length;
}

interface BlockLike {
  block_type: string;
  content: Record<string, unknown>;
}

export function countExercisesInBlocks(blocks: BlockLike[]): number {
  return blocks
    .filter((b) => b.block_type === "exercise_list")
    .reduce((sum, b) => {
      const exercises = (b.content as { exercises?: unknown[] })?.exercises ?? [];
      return sum + exercises.length;
    }, 0);
}

export function aggregateDayValue(
  series: SeriesEntry[] | undefined,
  metric: string
): number | null {
  if (!series || series.length === 0) return null;
  const vals = series
    .map((s) => s?.[metric])
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  if (SUM_METRICS.has(metric)) return sum;
  return Math.round((sum / vals.length) * 100) / 100;
}

export function buildPerformanceSeries(
  logs: LogForPerf[],
  meta: Map<string, ExerciseMeta>
): PerfExercise[] {
  const byExercise = new Map<string, PerfExercise>();
  const sorted = [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate));

  for (const log of sorted) {
    const done = log.exercisesDone ?? {};
    for (const [exId, entry] of Object.entries(done)) {
      const m = meta.get(exId);
      if (!m) continue;

      let pe = byExercise.get(exId);
      if (!pe) {
        pe = { exerciseId: exId, name: m.name, metrics: m.metrics, points: [] };
        byExercise.set(exId, pe);
      }

      const values: Record<string, number | null> = {};
      let hasAny = false;
      for (const metric of m.metrics) {
        const v = aggregateDayValue(entry?.series, metric);
        values[metric] = v;
        if (v != null) hasAny = true;
      }
      if (hasAny) pe.points.push({ date: log.logDate, values });
    }
  }

  return Array.from(byExercise.values());
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm run test:run -- __tests__/history-helpers.test.ts`
Expected: PASS (todos los `describe`).

- [ ] **Step 5: Commit**

```bash
git add lib/content/history-helpers.ts __tests__/history-helpers.test.ts
git commit -m "feat(fase-3): funciones puras de agregación del historial (TDD)"
```

---

## Task 3: Validación de fotos (`photo-validation.ts`)

**Files:**
- Create: `lib/portal/photo-validation.ts`
- Test: `__tests__/photo-validation.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `__tests__/photo-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  validatePhotoUpload,
  computeResizedDimensions,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
} from "@/lib/portal/photo-validation";

describe("validatePhotoUpload", () => {
  it("rejects disallowed type", () => {
    const r = validatePhotoUpload({ size: 1000, type: "application/pdf", existingCount: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejects oversized file", () => {
    const r = validatePhotoUpload({ size: MAX_PHOTO_BYTES + 1, type: "image/jpeg", existingCount: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejects when at the photo cap", () => {
    const r = validatePhotoUpload({ size: 1000, type: "image/jpeg", existingCount: MAX_PHOTOS });
    expect(r.ok).toBe(false);
  });
  it("accepts a valid jpeg under limits", () => {
    const r = validatePhotoUpload({ size: 1000, type: "image/jpeg", existingCount: 5 });
    expect(r.ok).toBe(true);
  });
});

describe("computeResizedDimensions", () => {
  it("leaves small images unchanged", () => {
    expect(computeResizedDimensions(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
  it("scales down by the longest side (landscape)", () => {
    expect(computeResizedDimensions(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 });
  });
  it("scales down by the longest side (portrait)", () => {
    expect(computeResizedDimensions(1440, 2560, 1280)).toEqual({ width: 720, height: 1280 });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm run test:run -- __tests__/photo-validation.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar `photo-validation.ts`**

Create `lib/portal/photo-validation.ts`:

```ts
// Validación y dimensionado de fotos. Puro (sin DOM/DB) → testeable.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTOS = 30;
export const MAX_PHOTO_DIMENSION = 1280;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface PhotoUploadCheck {
  size: number;
  type: string;
  existingCount: number;
}

export type PhotoValidation = { ok: true } | { ok: false; error: string };

export function validatePhotoUpload({
  size,
  type,
  existingCount,
}: PhotoUploadCheck): PhotoValidation {
  if (!ALLOWED_PHOTO_TYPES.includes(type)) {
    return { ok: false, error: "Formato no permitido. Usa JPG, PNG o WEBP." };
  }
  if (size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "La imagen supera el límite de 5 MB." };
  }
  if (existingCount >= MAX_PHOTOS) {
    return {
      ok: false,
      error: `Llegaste al máximo de ${MAX_PHOTOS} fotos. Borra alguna para subir más.`,
    };
  }
  return { ok: true };
}

export function computeResizedDimensions(
  width: number,
  height: number,
  max: number
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = width >= height ? max / width : max / height;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm run test:run -- __tests__/photo-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/portal/photo-validation.ts __tests__/photo-validation.test.ts
git commit -m "feat(fase-3): validación y dimensionado de fotos (TDD)"
```

---

## Task 4: Capa de datos del historial (`history.ts`)

**Files:**
- Create: `lib/content/history.ts`

(Código de integración con Supabase: se construye con `tsc` como gate y se valida en el smoke. La lógica testeable ya vive en `history-helpers.ts`.)

- [ ] **Step 1: Implementar `history.ts`**

Create `lib/content/history.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSeriesNumber } from "./access";
import {
  countCompleted,
  countExercisesInBlocks,
  buildPerformanceSeries,
  type ExerciseMeta,
  type ExercisesDone,
  type LogForPerf,
  type PerfExercise,
} from "./history-helpers";
import type { DayBlock } from "./queries";

export interface HistoryListItem {
  logId: string;
  logDate: string;
  dayTitle: string;
  workoutFocus: string | null;
  doneCount: number;
  totalCount: number;
}

export interface HistoryLogDetail {
  logId: string;
  logDate: string;
  day: {
    id: string;
    title: string;
    workout_focus: string | null;
    duration_minutes: number | null;
    day_of_week: string;
  };
  blocks: DayBlock[];
  exercisesDone: ExercisesDone | null;
  generalNotes: string | null;
}

// --- Tipos crudos de los SELECT (Relationships no tipadas en Database) ---
interface ListRow {
  id: string;
  log_date: string;
  program_day_id: string;
  exercises_done: ExercisesDone | null;
  program_days: { title: string; workout_focus: string | null; day_of_week: string };
}

interface BlockRow {
  day_id: string;
  block_type: string;
  sort_order: number;
  content: Record<string, unknown>;
}

/**
 * Lista cronológica (reciente primero) de días con progress_log de la clienta.
 */
export async function getHistoryList(userId: string): Promise<HistoryListItem[]> {
  const supabase = await createClient();

  const { data: rawLogs } = await supabase
    .from("progress_logs")
    .select(
      `id, log_date, program_day_id, exercises_done,
       program_days!inner ( title, workout_focus, day_of_week )`
    )
    .eq("profile_id", userId)
    .order("log_date", { ascending: false });

  const logs = (rawLogs ?? []) as unknown as ListRow[];
  if (logs.length === 0) return [];

  // Conteo total de ejercicios por día (de los bloques exercise_list).
  const dayIds = [...new Set(logs.map((l) => l.program_day_id))];
  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("day_id, block_type, sort_order, content")
    .in("day_id", dayIds);

  const blocks = (rawBlocks ?? []) as unknown as BlockRow[];
  const totalByDay = new Map<string, number>();
  for (const id of dayIds) {
    totalByDay.set(
      id,
      countExercisesInBlocks(blocks.filter((b) => b.day_id === id))
    );
  }

  return logs.map((l) => ({
    logId: l.id,
    logDate: l.log_date,
    dayTitle: l.program_days.title,
    workoutFocus: l.program_days.workout_focus,
    doneCount: countCompleted(l.exercises_done),
    totalCount: totalByDay.get(l.program_day_id) ?? 0,
  }));
}

interface SubRow {
  id: string;
  months_elapsed: number;
  current_period_start: string | null;
}

interface PerfLogRow {
  log_date: string;
  program_day_id: string;
  exercises_done: ExercisesDone | null;
}

interface ExBlockRow {
  day_id: string;
  block_type: string;
  content: { exercises?: Array<{ id: string; name: string; metrics?: string[] }> };
}

/**
 * Datos de las gráficas de desempeño, SOLO del mes corriente
 * (log_date >= current_period_start de la suscripción activa).
 */
export async function getPerformanceData(userId: string): Promise<PerfExercise[]> {
  const supabase = await createClient();

  const { data: rawSub } = await supabase
    .from("subscriptions")
    .select("id, months_elapsed, current_period_start")
    .eq("profile_id", userId)
    .eq("status", "active")
    .single();

  const sub = rawSub as unknown as SubRow | null;
  if (!sub || !sub.current_period_start) return [];

  const periodStart = sub.current_period_start.split("T")[0];

  const { data: rawLogs } = await supabase
    .from("progress_logs")
    .select("log_date, program_day_id, exercises_done")
    .eq("profile_id", userId)
    .gte("log_date", periodStart)
    .order("log_date", { ascending: true });

  const logs = (rawLogs ?? []) as unknown as PerfLogRow[];
  if (logs.length === 0) return [];

  const dayIds = [...new Set(logs.map((l) => l.program_day_id))];
  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("day_id, block_type, content")
    .in("day_id", dayIds)
    .eq("block_type", "exercise_list");

  const blocks = (rawBlocks ?? []) as unknown as ExBlockRow[];

  // Mapa exercise-uuid → { name, metrics } desde los bloques del mes.
  const meta = new Map<string, ExerciseMeta>();
  for (const b of blocks) {
    for (const ex of b.content?.exercises ?? []) {
      if (!meta.has(ex.id)) {
        meta.set(ex.id, { name: ex.name, metrics: ex.metrics ?? [] });
      }
    }
  }

  const perfLogs: LogForPerf[] = logs.map((l) => ({
    logDate: l.log_date,
    exercisesDone: l.exercises_done,
  }));

  return buildPerformanceSeries(perfLogs, meta);
}

interface DetailLogRow {
  id: string;
  log_date: string;
  program_day_id: string;
  exercises_done: ExercisesDone | null;
  general_notes: string | null;
}

interface DetailDayRow {
  id: string;
  title: string;
  workout_focus: string | null;
  duration_minutes: number | null;
  day_of_week: string;
}

/**
 * Detalle read-only de un día pasado. Valida que el log sea de la clienta.
 * Devuelve null si no existe o no le pertenece.
 */
export async function getHistoryLog(
  userId: string,
  logId: string
): Promise<HistoryLogDetail | null> {
  const supabase = await createClient();

  const { data: rawLog } = await supabase
    .from("progress_logs")
    .select("id, log_date, program_day_id, exercises_done, general_notes:notes")
    .eq("id", logId)
    .eq("profile_id", userId)
    .maybeSingle();

  const log = rawLog as unknown as DetailLogRow | null;
  if (!log) return null;

  const { data: rawDay } = await supabase
    .from("program_days")
    .select("id, title, workout_focus, duration_minutes, day_of_week")
    .eq("id", log.program_day_id)
    .single();

  const day = rawDay as unknown as DetailDayRow | null;
  if (!day) return null;

  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("id, block_type, sort_order, content")
    .eq("day_id", day.id)
    .order("sort_order");

  return {
    logId: log.id,
    logDate: log.log_date,
    day,
    blocks: (rawBlocks ?? []) as DayBlock[],
    exercisesDone: log.exercises_done,
    generalNotes: log.general_notes,
  };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (los `as unknown as` evitan el problema de Relationships no tipadas, igual que en `queries.ts`).

- [ ] **Step 3: Commit**

```bash
git add lib/content/history.ts
git commit -m "feat(fase-3): queries del historial (lista, desempeño, detalle)"
```

---

## Task 5: `ExerciseListLogged` + extender `BlockView`

**Files:**
- Create: `components/portal/blocks/ExerciseListLogged.tsx`
- Modify: `components/portal/blocks/BlockView.tsx`

- [ ] **Step 1: Implementar `ExerciseListLogged.tsx`**

Create `components/portal/blocks/ExerciseListLogged.tsx`:

```tsx
import { Check } from "lucide-react";
import type { ReadOnlyExercise } from "./ExerciseListReadOnly";
import type { ExercisesDone } from "@/lib/content/history-helpers";

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  reps_done: { label: "Reps", unit: "" },
  weight_kg: { label: "Peso", unit: " kg" },
};

function formatMetric(metric: string, value: number | null | undefined): string {
  if (value == null) return "—";
  const cfg = METRIC_LABELS[metric] ?? { label: metric, unit: "" };
  return `${value}${cfg.unit}`;
}

export function ExerciseListLogged({
  content,
  loggedExercises,
}: {
  content: { exercises: ReadOnlyExercise[] };
  loggedExercises: ExercisesDone | null;
}) {
  const exercises = content?.exercises ?? [];
  if (exercises.length === 0) return null;
  const done = loggedExercises ?? {};

  return (
    <div className="mb-6 flex flex-col gap-3">
      {exercises.map((ex) => {
        const entry = done[ex.id];
        const series = entry?.series ?? [];
        const metrics = ex.metrics ?? ["reps_done", "weight_kg"];
        return (
          <div
            key={ex.id}
            className="rounded-xl p-4"
            style={{
              background: "#fff",
              border: "1.5px solid var(--gris-linea)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="font-head" style={{ fontSize: 16, fontWeight: 600 }}>
                {ex.name}
              </p>
              {entry?.completed && (
                <span
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 22, height: 22, background: "rgba(76,175,125,.16)" }}
                >
                  <Check size={14} color="#3a8c60" />
                </span>
              )}
            </div>

            <p className="font-body mt-1" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
              Meta: {ex.sets}×{ex.reps}
              {ex.rest_seconds != null && <> · Descanso: {ex.rest_seconds} seg</>}
            </p>

            <div className="mt-3 flex flex-col gap-1.5">
              {Array.from({ length: ex.sets }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 font-body"
                  style={{ fontSize: 13 }}
                >
                  <span style={{ color: "var(--gris-texto)", minWidth: 56 }}>
                    Serie {i + 1}
                  </span>
                  {metrics.map((m) => (
                    <span key={m} style={{ fontWeight: 600 }}>
                      {METRIC_LABELS[m]?.label ?? m}: {formatMetric(m, series[i]?.[m])}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Extender `BlockView` con `loggedExercises`**

Modify `components/portal/blocks/BlockView.tsx` — reemplazar el archivo completo:

```tsx
"use client";
import { TextBlock } from "./TextBlock";
import { YoutubeBlock } from "./YoutubeBlock";
import { PdfBlock } from "./PdfBlock";
import { ImageBlock } from "./ImageBlock";
import { CardioZone2Block } from "./CardioZone2Block";
import { ExerciseListReadOnly, type ReadOnlyExercise } from "./ExerciseListReadOnly";
import { ExerciseListLogged } from "./ExerciseListLogged";
import type { ExercisesDone } from "@/lib/content/history-helpers";

export interface ViewBlock {
  id: string;
  block_type: string;
  content: Record<string, unknown>;
}

export function BlockView({
  block,
  loggedExercises,
}: {
  block: ViewBlock;
  loggedExercises?: ExercisesDone | null;
}) {
  switch (block.block_type) {
    case "text":
      return <TextBlock content={block.content as { html: string }} />;
    case "youtube":
      return <YoutubeBlock content={block.content as { video_id: string; title: string }} />;
    case "pdf":
      return (
        <PdfBlock content={block.content as { storage_path: string; filename: string; label: string }} />
      );
    case "image":
      return <ImageBlock content={block.content as { storage_path: string; alt: string }} />;
    case "cardio_zone2":
      return <CardioZone2Block />;
    case "exercise_list":
      if (loggedExercises !== undefined) {
        return (
          <ExerciseListLogged
            content={block.content as { exercises: ReadOnlyExercise[] }}
            loggedExercises={loggedExercises}
          />
        );
      }
      return <ExerciseListReadOnly content={block.content as { exercises: ReadOnlyExercise[] }} />;
    default:
      return null;
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/portal/blocks/ExerciseListLogged.tsx components/portal/blocks/BlockView.tsx
git commit -m "feat(fase-3): ExerciseListLogged + BlockView con valores registrados"
```

---

## Task 6: Vista de detalle `/portal/history/[logId]`

**Files:**
- Create: `components/portal/HistoryDayView.tsx`
- Create: `app/portal/history/[logId]/page.tsx`

- [ ] **Step 1: Implementar `HistoryDayView.tsx`**

Create `components/portal/HistoryDayView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ChevronLeft, Clock, Dumbbell } from "lucide-react";
import { PortalHeader } from "./PortalHeader";
import { BlockView } from "./blocks/BlockView";
import type { HistoryLogDetail } from "@/lib/content/history";

const DAY_LABELS: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function formatLogDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  const str = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function HistoryDayView({ detail }: { detail: HistoryLogDetail }) {
  const dateLabel = formatLogDate(detail.logDate);

  return (
    <div style={{ background: "var(--blanco)" }}>
      <PortalHeader dateLabel={dateLabel} />

      <div className="px-4 pt-4 pb-8">
        <Link
          href="/portal/history"
          className="flex items-center gap-1 font-body mb-4"
          style={{ fontSize: 13, color: "var(--gris-texto)" }}
        >
          <ChevronLeft size={16} />
          Volver al historial
        </Link>

        <div className="mb-5">
          <span
            className="inline-flex items-center gap-1.5 font-body rounded-full px-3 py-1 mb-2"
            style={{ fontSize: 12, fontWeight: 600, background: "var(--rosa)", color: "#5e3d38" }}
          >
            📅 {dateLabel}
          </span>
          <h1 className="font-head mb-3" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
            {detail.day.title}
          </h1>
          <div className="flex gap-2 flex-wrap">
            {detail.day.workout_focus && (
              <span
                className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
                style={{ fontSize: 12.5, fontWeight: 600, background: "var(--lavanda-tint)", color: "var(--lavanda-dark)" }}
              >
                <Dumbbell size={13} />
                {detail.day.workout_focus}
              </span>
            )}
            {detail.day.duration_minutes && (
              <span
                className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
                style={{ fontSize: 12.5, background: "var(--gris-claro)", color: "var(--gris-texto)" }}
              >
                <Clock size={13} />
                {detail.day.duration_minutes} minutos
              </span>
            )}
          </div>
        </div>

        {detail.blocks.map((block) => (
          <BlockView key={block.id} block={block} loggedExercises={detail.exercisesDone} />
        ))}

        {detail.generalNotes && (
          <div className="mt-4">
            <p className="font-body mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
              Mis notas de ese día
            </p>
            <p
              className="font-body rounded-xl"
              style={{ padding: "12px 14px", background: "var(--gris-claro)", fontSize: 14, whiteSpace: "pre-wrap" }}
            >
              {detail.generalNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementar la ruta `[logId]/page.tsx`**

Create `app/portal/history/[logId]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHistoryLog } from "@/lib/content/history";
import { HistoryDayView } from "@/components/portal/HistoryDayView";

export default async function HistoryDetailPage({
  params,
}: {
  params: { logId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const detail = await getHistoryLog(user.id, params.logId);
  if (!detail) notFound();

  return <HistoryDayView detail={detail} />;
}
```

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK, la ruta `/portal/history/[logId]` aparece en el output.

- [ ] **Step 4: Commit**

```bash
git add components/portal/HistoryDayView.tsx app/portal/history/\[logId\]/page.tsx
git commit -m "feat(fase-3): vista de detalle read-only /portal/history/[logId]"
```

---

## Task 7: Endpoints de fotos + compresión cliente

**Files:**
- Create: `lib/portal/photo-compress.ts`
- Create: `app/api/portal/photos/route.ts`
- Create: `app/api/portal/photos/[id]/route.ts`

- [ ] **Step 1: Implementar compresión en cliente**

Create `lib/portal/photo-compress.ts`:

```ts
"use client";
import { computeResizedDimensions, MAX_PHOTO_DIMENSION } from "./photo-validation";

/**
 * Reduce la imagen a MAX_PHOTO_DIMENSION (lado mayor) y recomprime a JPEG.
 * Devuelve un File listo para subir. Si algo falla, devuelve el original.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = computeResizedDimensions(
      bitmap.width,
      bitmap.height,
      MAX_PHOTO_DIMENSION
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82)
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
```

- [ ] **Step 2: Implementar `POST /api/portal/photos`**

Create `app/api/portal/photos/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validatePhotoUpload } from "@/lib/portal/photo-validation";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const caption = (form.get("caption") as string | null) ?? null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }

  // Conteo actual de fotos de la clienta (para el tope).
  const { count } = await supabase
    .from("progress_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  const check = validatePhotoUpload({
    size: file.size,
    type: file.type,
    existingCount: count ?? 0,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const today = new Date().toISOString().split("T")[0];

  const admin = createServiceClient();
  const { error: uploadError } = await admin.storage
    .from("progress")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;
  const { data, error: insertError } = await client
    .from("progress_photos")
    .insert({
      profile_id: user.id,
      storage_path: path,
      photo_date: today,
      caption,
    })
    .select("id")
    .single();

  if (insertError) {
    await admin.storage.from("progress").remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
```

- [ ] **Step 3: Implementar `DELETE /api/portal/photos/[id]`**

Create `app/api/portal/photos/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Valida pertenencia y obtiene el path.
  const { data: rawPhoto } = await supabase
    .from("progress_photos")
    .select("id, storage_path, profile_id")
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .maybeSingle();

  const photo = rawPhoto as unknown as { storage_path: string } | null;
  if (!photo) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const admin = createServiceClient();
  await admin.storage.from("progress").remove([photo.storage_path]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("progress_photos").delete().eq("id", params.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verificar build**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK; rutas `/api/portal/photos` y `/api/portal/photos/[id]` listadas.

- [ ] **Step 5: Commit**

```bash
git add lib/portal/photo-compress.ts app/api/portal/photos/route.ts app/api/portal/photos/\[id\]/route.ts
git commit -m "feat(fase-3): endpoints de fotos (upload/borrar) + compresión cliente"
```

---

## Task 8: Gráfica de desempeño (Recharts) + tab Desempeño

**Files:**
- Create: `components/portal/PerformanceChart.tsx`
- Create: `components/portal/PerformanceTab.tsx`

- [ ] **Step 1: Implementar `PerformanceChart.tsx`**

Create `components/portal/PerformanceChart.tsx`:

```tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { PerfPoint } from "@/lib/content/history-helpers";

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  reps_done: { label: "Reps", unit: "" },
  weight_kg: { label: "Peso", unit: " kg" },
};

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function PerformanceChart({
  points,
  metric,
}: {
  points: PerfPoint[];
  metric: string;
}) {
  const unit = METRIC_LABELS[metric]?.unit ?? "";
  const data = points
    .filter((p) => p.values[metric] != null)
    .map((p) => ({ date: shortDate(p.date), value: p.values[metric] as number }));

  if (data.length < 2) {
    return (
      <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 13, color: "var(--gris-texto)" }}>
        Registra al menos 2 entrenamientos para ver tu progreso
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#f0eae9" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          formatter={(v: number) => [`${v}${unit}`, METRIC_LABELS[metric]?.label ?? metric]}
          contentStyle={{ borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }}
        />
        <Line type="monotone" dataKey="value" stroke="#9982f4" strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: "#9982f4", strokeWidth: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Implementar `PerformanceTab.tsx`**

Create `components/portal/PerformanceTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Dumbbell } from "lucide-react";
import { PerformanceChart } from "./PerformanceChart";
import type { PerfExercise } from "@/lib/content/history-helpers";
import type { HistoryListItem } from "@/lib/content/history";

const METRIC_LABELS: Record<string, string> = {
  reps_done: "Reps",
  weight_kg: "Peso",
};

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PerformanceTab({
  performance,
  history,
}: {
  performance: PerfExercise[];
  history: HistoryListItem[];
}) {
  const [exIdx, setExIdx] = useState(0);
  const selected = performance[exIdx];
  const [metric, setMetric] = useState<string>(selected?.metrics[0] ?? "weight_kg");

  // Asegura que la métrica seleccionada exista para el ejercicio actual.
  const activeMetric = selected?.metrics.includes(metric)
    ? metric
    : selected?.metrics[0] ?? "weight_kg";

  return (
    <>
      {performance.length === 0 ? (
        <div className="font-body" style={{ textAlign: "center", padding: "32px 10px", fontSize: 14, color: "var(--gris-texto)" }}>
          Aún no hay registros este mes. Cuando guardes tu progreso, aquí verás tus gráficas.
        </div>
      ) : (
        <>
          <h3 className="font-head" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            Tu desempeño
          </h3>
          <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)", marginBottom: 12 }}>
            Tu progreso este mes, ejercicio por ejercicio.
          </p>

          {/* Selector de ejercicio (pills) */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ marginBottom: 12 }}>
            {performance.map((p, i) => (
              <button
                key={p.exerciseId}
                onClick={() => setExIdx(i)}
                className="font-body whitespace-nowrap rounded-full px-3 py-1.5"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  background: i === exIdx ? "var(--lavanda)" : "var(--gris-claro)",
                  color: i === exIdx ? "#fff" : "var(--gris-texto)",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Toggle de métrica */}
          {selected && selected.metrics.length > 1 && (
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              {selected.metrics.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className="font-body rounded-full px-3 py-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    background: m === activeMetric ? "var(--negro)" : "var(--gris-claro)",
                    color: m === activeMetric ? "#fff" : "var(--gris-texto)",
                  }}
                >
                  {METRIC_LABELS[m] ?? m}
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl p-3" style={{ background: "#fff", border: "1.5px solid var(--gris-linea)", marginBottom: 24 }}>
            {selected && <PerformanceChart points={selected.points} metric={activeMetric} />}
          </div>
        </>
      )}

      <h3 className="font-head" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Historial de ejercicios
      </h3>
      {history.length === 0 ? (
        <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
          Todavía no tienes entrenamientos registrados.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <Link
              key={h.logId}
              href={`/portal/history/${h.logId}`}
              className="flex items-center justify-between rounded-xl"
              style={{ padding: "13px 16px", background: "#fff", border: "1.5px solid var(--gris-linea)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 36, height: 36, background: "var(--lavanda-tint)", flexShrink: 0 }}
                >
                  <Dumbbell size={17} color="var(--lavanda-dark)" />
                </div>
                <div>
                  <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>
                    {h.dayTitle}
                  </div>
                  <div className="font-body" style={{ fontSize: 11.5, color: "var(--gris-suave)" }}>
                    {shortDate(h.logDate)}
                    {h.workoutFocus ? ` · ${h.workoutFocus}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="font-body rounded-full px-2.5 py-1"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: h.totalCount > 0 && h.doneCount === h.totalCount ? "rgba(76,175,125,.14)" : "var(--gris-claro)",
                    color: h.totalCount > 0 && h.doneCount === h.totalCount ? "#3a8c60" : "var(--gris-texto)",
                  }}
                >
                  {h.doneCount}/{h.totalCount} ejercicios
                </span>
                <ChevronRight size={16} color="var(--gris-suave)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/portal/PerformanceChart.tsx components/portal/PerformanceTab.tsx
git commit -m "feat(fase-3): gráfica Recharts + tab Desempeño con Historial de ejercicios"
```

---

## Task 9: Tab Fotos (grid, filtro por mes, subir, visor, borrar)

**Files:**
- Create: `components/portal/PhotosTab.tsx`

- [ ] **Step 1: Implementar `PhotosTab.tsx`**

Create `components/portal/PhotosTab.tsx`:

```tsx
"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { compressImage } from "@/lib/portal/photo-compress";

export interface PhotoItem {
  id: string;
  url: string; // signed URL
  photoDate: string; // "YYYY-MM-DD"
  caption: string | null;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key: string): string {
  const d = new Date(`${key}-01T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PhotosTab({ photos }: { photos: PhotoItem[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");

  const months = useMemo(() => {
    const keys = [...new Set(photos.map((p) => monthKey(p.photoDate)))].sort().reverse();
    return keys;
  }, [photos]);
  const [filter, setFilter] = useState<string>("todas");

  const visible = filter === "todas" ? photos : photos.filter((p) => monthKey(p.photoDate) === filter);

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(pendingFile);
      const form = new FormData();
      form.append("file", compressed);
      if (caption.trim()) form.append("caption", caption.trim());
      const res = await fetch("/api/portal/photos", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo subir la foto.");
      } else {
        setPendingFile(null);
        setCaption("");
        router.refresh();
      }
    } catch {
      setError("No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/portal/photos/${id}`, { method: "DELETE" });
    setViewIdx(null);
    router.refresh();
  }

  return (
    <>
      {/* Botón subir */}
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center justify-center gap-2 w-full rounded-xl font-body"
        style={{ padding: "12px", background: "var(--lavanda)", color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 16 }}
      >
        <Camera size={18} /> Subir foto
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPendingFile(f);
          e.target.value = "";
        }}
      />

      {/* Filtro por mes */}
      {months.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ marginBottom: 16 }}>
          {[["todas", "Todas"], ...months.map((m) => [m, monthLabel(m)] as [string, string])].map(
            ([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className="font-body whitespace-nowrap rounded-full px-3 py-1.5"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  background: filter === v ? "var(--lavanda)" : "var(--gris-claro)",
                  color: filter === v ? "#fff" : "var(--gris-texto)",
                }}
              >
                {l}
              </button>
            )
          )}
        </div>
      )}

      {/* Grid o empty */}
      {visible.length === 0 ? (
        <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 14, color: "var(--gris-texto)" }}>
          Aún no tienes fotos de progreso. Sube tu primera para empezar.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {visible.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setViewIdx(i)}
              style={{ border: "none", padding: 0, borderRadius: 10, overflow: "hidden", position: "relative", cursor: "pointer", aspectRatio: "1" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.caption ?? "Foto de progreso"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(26,26,26,.6)", color: "#fff", fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 5 }}>
                {dayLabel(f.photoDate)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Modal de confirmación de subida (comentario) */}
      {pendingFile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(26,26,26,.6)", display: "flex", alignItems: "flex-end" }}>
          <div className="w-full rounded-t-2xl" style={{ background: "#fff", padding: 20, maxWidth: 640, margin: "0 auto" }}>
            <p className="font-head" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Nueva foto</p>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Comentario (opcional). No se puede editar después."
              rows={2}
              className="w-full font-body rounded-xl resize-none"
              style={{ padding: "12px 14px", background: "var(--gris-claro)", border: "1.5px solid transparent", fontSize: 14, outline: "none", marginBottom: 12 }}
            />
            {error && <p className="font-body" style={{ color: "#e05c5c", fontSize: 13, marginBottom: 10 }}>{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setPendingFile(null); setCaption(""); setError(null); }}
                className="flex-1 rounded-xl font-body"
                style={{ padding: 12, background: "var(--gris-claro)", fontWeight: 600, fontSize: 14 }}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 rounded-xl font-body"
                style={{ padding: 12, background: "var(--lavanda)", color: "#fff", fontWeight: 600, fontSize: 14 }}
                disabled={uploading}
              >
                {uploading ? "Subiendo…" : "Subir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor (lightbox) */}
      {viewIdx !== null && visible[viewIdx] && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(26,26,26,.92)", display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between" style={{ padding: 16 }}>
            <span className="font-body" style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
              {dayLabel(visible[viewIdx].photoDate)}
            </span>
            <button onClick={() => setViewIdx(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X size={24} color="#fff" />
            </button>
          </div>
          <div className="flex items-center justify-center" style={{ flex: 1, padding: "0 16px", position: "relative" }}>
            {viewIdx > 0 && (
              <button onClick={() => setViewIdx(viewIdx - 1)} style={{ position: "absolute", left: 8, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronLeft size={22} color="#fff" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={visible[viewIdx].url} alt={visible[viewIdx].caption ?? "Foto"} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 12 }} />
            {viewIdx < visible.length - 1 && (
              <button onClick={() => setViewIdx(viewIdx + 1)} style={{ position: "absolute", right: 8, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronRight size={22} color="#fff" />
              </button>
            )}
          </div>
          <div style={{ padding: 16 }}>
            {visible[viewIdx].caption && (
              <p className="font-body" style={{ color: "#fff", fontSize: 14, marginBottom: 12, textAlign: "center" }}>
                {visible[viewIdx].caption}
              </p>
            )}
            <button
              onClick={() => handleDelete(visible[viewIdx].id)}
              className="flex items-center justify-center gap-2 w-full rounded-xl font-body"
              style={{ padding: 12, background: "rgba(224,92,92,.18)", color: "#ff9b9b", fontWeight: 600, fontSize: 14 }}
            >
              <Trash2 size={16} /> Borrar foto
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/portal/PhotosTab.tsx
git commit -m "feat(fase-3): tab Fotos (grid, filtro por mes, subir, visor, borrar)"
```

---

## Task 10: `ProgressView` (tabs) + ruta `/portal/history`

**Files:**
- Create: `components/portal/ProgressView.tsx`
- Create: `app/portal/history/page.tsx`

- [ ] **Step 1: Implementar `ProgressView.tsx`**

Create `components/portal/ProgressView.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PortalHeader } from "./PortalHeader";
import { PerformanceTab } from "./PerformanceTab";
import { PhotosTab, type PhotoItem } from "./PhotosTab";
import type { PerfExercise } from "@/lib/content/history-helpers";
import type { HistoryListItem } from "@/lib/content/history";

function todayLabel(): string {
  const s = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ProgressView({
  performance,
  history,
  photos,
}: {
  performance: PerfExercise[];
  history: HistoryListItem[];
  photos: PhotoItem[];
}) {
  const [tab, setTab] = useState<"desempeno" | "fotos">("desempeno");

  return (
    <div style={{ background: "var(--blanco)", minHeight: "100%" }}>
      <PortalHeader dateLabel={todayLabel()} />

      <div style={{ padding: "0 18px", borderBottom: "1px solid var(--gris-linea)" }}>
        <div className="flex gap-6">
          {[["desempeno", "Desempeño"], ["fotos", "Fotos"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v as "desempeno" | "fotos")}
              className="font-body"
              style={{
                padding: "14px 0",
                fontSize: 14,
                fontWeight: 600,
                color: tab === v ? "var(--negro)" : "var(--gris-suave)",
                borderBottom: tab === v ? "2px solid var(--lavanda)" : "2px solid transparent",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 18px 28px" }}>
        {tab === "desempeno" ? (
          <PerformanceTab performance={performance} history={history} />
        ) : (
          <PhotosTab photos={photos} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementar la ruta `/portal/history/page.tsx`**

Create `app/portal/history/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHistoryList, getPerformanceData } from "@/lib/content/history";
import { ProgressView } from "@/components/portal/ProgressView";
import type { PhotoItem } from "@/components/portal/PhotosTab";

interface PhotoRow {
  id: string;
  storage_path: string;
  photo_date: string;
  caption: string | null;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [history, performance] = await Promise.all([
    getHistoryList(user.id),
    getPerformanceData(user.id),
  ]);

  // Fotos + signed URLs (bucket privado).
  const { data: rawPhotos } = await supabase
    .from("progress_photos")
    .select("id, storage_path, photo_date, caption")
    .eq("profile_id", user.id)
    .order("photo_date", { ascending: false });

  const photoRows = (rawPhotos ?? []) as unknown as PhotoRow[];
  const photos: PhotoItem[] = [];
  for (const p of photoRows) {
    const { data: signed } = await supabase.storage
      .from("progress")
      .createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) {
      photos.push({
        id: p.id,
        url: signed.signedUrl,
        photoDate: p.photo_date,
        caption: p.caption,
      });
    }
  }

  return <ProgressView performance={performance} history={history} photos={photos} />;
}
```

- [ ] **Step 3: Verificar build completo**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK; `/portal/history` y `/portal/history/[logId]` listadas en el output.

- [ ] **Step 4: Commit**

```bash
git add components/portal/ProgressView.tsx app/portal/history/page.tsx
git commit -m "feat(fase-3): ProgressView (tabs) + ruta /portal/history con signed URLs"
```

---

## Task 11: Gates finales + smoke manual

**Files:** ninguno (verificación)

- [ ] **Step 1: Correr toda la batería de gates**

Run: `npm run test:run && npx tsc --noEmit && npm run lint && npm run build`
Expected: vitest todo verde (incluye los nuevos tests), tsc limpio, lint limpio, build OK.

- [ ] **Step 2: Smoke manual con `DEV_DATE`**

Con `npm run dev` y una clienta de prueba con varios `progress_logs` ya registrados (usar `DEV_DATE` para avanzar días y registrar progreso en `/portal/today` antes del smoke):
1. Ir a `/portal/history` → tab Desempeño: aparecen pills de ejercicio, gráfica (o el mensaje de <2 registros), y la lista "Historial de ejercicios".
2. Tocar una fila → abre `/portal/history/[logId]` en modo lectura: bloques visibles, ejercicios con valores registrados por serie, notas, sin botón de guardar, badge "📅 {fecha}".
3. Tab Fotos: subir una foto con comentario → aparece en el grid con su fecha; el filtro por mes funciona; abrir el visor → navegar ← →, ver comentario, borrar → desaparece.
4. Copiar la signed URL de una foto, esperar/abrir en incógnito sin sesión tras expirar, o construir la URL pública del bucket → confirmar que NO es accesible públicamente (solo signed URL temporal).
5. Verificar el toggle reps/peso en un ejercicio con ambas métricas.

- [ ] **Step 3: Actualizar handoff y bloque de contexto**

Actualizar `handoff.md` (sección 10/11: marcar Fase 3 completada con resumen) y, si aplica, anotar en `MEMORY.md` el avance. Commit:

```bash
git add handoff.md
git commit -m "docs: Fase 3 (Historial) completada — handoff actualizado"
```

- [ ] **Step 4: Integración de rama**

Usar el skill `superpowers:finishing-a-development-branch` para decidir merge/PR de `feature/fase-3-historial` a `main`.

---

## Self-Review (cobertura del spec)

- **Sec 1 (rutas/nav):** Tasks 6 y 10 (`/portal/history`, `/portal/history/[logId]`). ✓
- **Sec 2 (capa de datos):** Task 4 (`getHistoryList`, `getPerformanceData` con `current_period_start`, `getHistoryLog`) + Task 2 (puras). ✓
- **Sec 3 (detalle read-only):** Tasks 5 (`ExerciseListLogged`, `BlockView` con `loggedExercises`) y 6 (`HistoryDayView`, badge 📅, sin guardar). ✓
- **Sec 4 (fotos):** Task 1 (migración bucket privado + `caption` + policies), Task 3 (validación: 5MB/30/tipos), Task 7 (upload/borrar + compresión 1280px), Tasks 9/10 (UI grid 3 col + filtro por mes + visor + signed URLs). ✓
- **Sec 5 (gráficas):** Task 8 (Recharts, pills de ejercicio, toggle métrica dinámico, sin periodo, agregación promedio/suma, <2 puntos, lista "Historial de ejercicios"). ✓
- **Sec 6 (migración/deps/tests):** Task 1 (recharts + migración), Tasks 2/3 (TDD), Task 11 (gates + smoke + URL privada). ✓

Sin placeholders. Tipos consistentes entre tareas (`PerfExercise`, `PerfPoint`, `HistoryListItem`, `HistoryLogDetail`, `ExercisesDone`, `PhotoItem`, `validatePhotoUpload`, `computeResizedDimensions`).
