# Subsistemas E y F — Editor de Día, Gestión de Contenido y Pilares — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la Fase 2 entregando el editor de día del CMS (metadata + bloques arrastrables, incluyendo un block type de calculadora Cardio Zona 2), la gestión de días (clonar/duplicar/eliminar) y los pilares mensuales de CuarentaMás/Extra.

**Architecture:** Next.js 14 App Router. Los server components hacen el data-fetching (vía `lib/admin/queries.ts` con cliente Supabase anon + RLS `is_admin()`); los client components manejan la interactividad. Las mutaciones van por server actions (`lib/admin/dayActions.ts`). Los archivos se suben por un route handler que usa el cliente service-role (`createServiceClient`). Los bloques de contenido se reusan entre días y pilares (mismas estructuras JSONB y mismos editores/renderers). Subsistema F depende de E (reusa sus editores de bloque).

**Tech Stack:** Next.js 14, TypeScript, Supabase (PostgreSQL + RLS + Storage), Tailwind, Tiptap (editor de texto), dnd-kit (reordenar bloques), vitest (tests).

**Spec de referencia:** `docs/superpowers/specs/2026-06-08-fase-2-editor-dia-y-pilares-design.md`

---

## Convenciones del proyecto (leer antes de empezar)

- `day_of_week` en DB es **sin acento**: `lunes, martes, miercoles, jueves, viernes, sabado, domingo`.
- Cliente Supabase en server components/actions admin: `import { createClient } from "@/lib/supabase/server"` (anon + RLS).
- Cliente service-role (solo para Storage en el route handler): `import { createServiceClient } from "@/lib/supabase/service"`.
- Tokens CSS en `globals.css`: `--lavanda`, `--lavanda-dark`, `--lavanda-tint`, `--rosa-soft`, `--negro`, `--gris-texto`, `--gris-suave`, `--gris-linea`, `--shadow-card`. Tipografías: `font-head` (Oswald), `font-body` (Hind).
- Selects anidados de Supabase: castear `as unknown as Type` (las relaciones no están en el tipo generado). Ver `lib/admin/queries.ts` y `lib/content/queries.ts`.
- Tests: vitest con `globals: true` (`describe/it/expect` globales o importados de `"vitest"`). Mirar `__tests__/content-access.test.ts` para el estilo. `server-only` está aliasado a un módulo vacío en `vitest.config.ts`, así que se pueden importar módulos con `import "server-only"`.
- Cada migración SQL nueva vive en `supabase/migrations/`. Hay que aplicarla también en el dashboard de Supabase (proyecto `bgvxaagfnzvzamtxqbkg`) — se anota como paso manual.

---

## File Structure

**Migración:**
- Create `supabase/migrations/004_editor_pilares.sql` — rename `day_type`, `block_type += cardio_zone2` (en `program_day_blocks`), tablas `program_series_pillars` + `program_pillar_blocks` + RLS + triggers, bucket de Storage `content`.

**Funciones puras (testeables):**
- Create `lib/content/cardio.ts` — `cardioZone2(edad)`.
- Create `lib/admin/youtube.ts` — `extractVideoId(url)`.

**Subsistema E — autoría de un día:**
- Modify `lib/admin/queries.ts` — `getDayWithBlocks(dayId)`, tipos `BlockData`/`DayWithBlocks`.
- Create `lib/admin/dayActions.ts` — `saveDay`, `saveBlocks` (+ `cloneDay`/`cloneWeek`/`deleteDay` en Fase 2).
- Create `app/api/admin/upload/route.ts` — sube archivo a Storage.
- Create `components/admin/blocks/{Text,Youtube,Pdf,Image,ExerciseList,CardioZone2}BlockEditor.tsx`.
- Create `components/admin/DayEditorForm.tsx` — orquesta metadata + bloques + dnd.
- Create `app/admin/content/[programId]/series/[seriesId]/days/new/page.tsx`.
- Create `app/admin/content/[programId]/series/[seriesId]/days/[dayId]/page.tsx`.
- Create `components/portal/blocks/CardioZone2Block.tsx` — renderer interactivo en el portal.
- Modify `components/portal/TodayView.tsx` — descanso editable + badge `day_type` + caso `cardio_zone2`.
- Modify `lib/content/queries.ts` — agregar `cardio_zone2` a la unión `DayBlock["block_type"]`.

**Subsistema F — gestión + pilares:**
- Modify `lib/admin/dayActions.ts` — `cloneDay`, `cloneWeek`, `deleteDay`.
- Modify `components/admin/WeeklyGrid.tsx` — menú de acciones por celda + clonar semana.
- Create `lib/admin/pillarActions.ts` — `savePillar`, `savePillarBlocks`.
- Modify `lib/admin/queries.ts` — `getSeriesPillars`, `getPillarWithBlocks`.
- Create `app/admin/content/[programId]/series/[seriesId]/pillars/page.tsx` — lista de pilares.
- Create `app/admin/content/[programId]/series/[seriesId]/pillars/[pillarKey]/page.tsx` — editor de pilar.
- Create `components/admin/PillarEditorForm.tsx` — reusa la lista de bloques de E.
- Modify `components/admin/SeriesAccordion.tsx` — link "Pilares" en series CuarentaMás/Extra.
- Create `lib/content/pillars.ts` — `getCurrentMonthPillars(userId)`.
- Create `app/portal/pilares/page.tsx` — sección de pilares del mes actual.
- Create `components/portal/PillarsView.tsx` — acordeón que reusa los renderers de bloque.
- Create `components/portal/blocks/BlockView.tsx` — renderer de bloque **read-only** reutilizable (extraído para pilares).

---

## FASE 0 — Migración y funciones puras

### Task 0.1: Función pura `cardioZone2`

**Files:**
- Create: `lib/content/cardio.ts`
- Test: `__tests__/cardio.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/cardio.test.ts
import { describe, it, expect } from "vitest";
import { cardioZone2 } from "@/lib/content/cardio";

describe("cardioZone2", () => {
  it("computes floor and ceiling for age 50", () => {
    // (220-50)=170 → 170*0.6=102, 170*0.7=119
    expect(cardioZone2(50)).toEqual({ suelo: 102, cielo: 119 });
  });

  it("rounds to nearest integer for age 45", () => {
    // (220-45)=175 → 175*0.6=105, 175*0.7=122.5 → 123
    expect(cardioZone2(45)).toEqual({ suelo: 105, cielo: 123 });
  });

  it("returns nulls for non-finite input", () => {
    expect(cardioZone2(NaN)).toEqual({ suelo: null, cielo: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/cardio.test.ts`
Expected: FAIL — `cardioZone2` no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/content/cardio.ts
export interface CardioZone2Range {
  suelo: number | null;
  cielo: number | null;
}

/**
 * Cardio Zona 2 = 60–70% de la frecuencia cardiaca máxima estimada (220 - edad).
 * Fórmula fija; no se persiste. Devuelve enteros redondeados.
 */
export function cardioZone2(edad: number): CardioZone2Range {
  if (!Number.isFinite(edad) || edad <= 0) {
    return { suelo: null, cielo: null };
  }
  const fcMax = 220 - edad;
  return {
    suelo: Math.round(fcMax * 0.6),
    cielo: Math.round(fcMax * 0.7),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/cardio.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/content/cardio.ts __tests__/cardio.test.ts
git commit -m "feat: cardioZone2 pure function (Cardio Zona 2 range)"
```

### Task 0.2: Función pura `extractVideoId`

**Files:**
- Create: `lib/admin/youtube.ts`
- Test: `__tests__/youtube.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/youtube.test.ts
import { describe, it, expect } from "vitest";
import { extractVideoId } from "@/lib/admin/youtube";

describe("extractVideoId", () => {
  it("extracts from watch?v= URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from youtu.be short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts when extra query params follow", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for a non-YouTube URL", () => {
    expect(extractVideoId("https://vimeo.com/12345")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/youtube.test.ts`
Expected: FAIL — `extractVideoId` no existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/admin/youtube.ts
export function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s?]+)/);
  return m?.[1] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/youtube.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/youtube.ts __tests__/youtube.test.ts
git commit -m "feat: extractVideoId pure function"
```

### Task 0.3: Migración 004 (esquema)

**Files:**
- Create: `supabase/migrations/004_editor_pilares.sql`

> Nota: el nombre exacto de la constraint de `block_type`/`day_type` puede variar. El SQL abajo borra por nombre derivado del default de Postgres (`<tabla>_<columna>_check`). Si el nombre real difiere, ajustarlo tras inspeccionar con `\d program_days` en el dashboard.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/004_editor_pilares.sql

-- 1.1 Rename day_type 'assessment' → 'cardio'
alter table program_days drop constraint program_days_day_type_check;
alter table program_days add constraint program_days_day_type_check
  check (day_type in ('workout', 'rest', 'cardio'));

-- 1.3 Nuevo block type cardio_zone2 en program_day_blocks
alter table program_day_blocks drop constraint program_day_blocks_block_type_check;
alter table program_day_blocks add constraint program_day_blocks_block_type_check
  check (block_type in ('text','youtube','pdf','image','exercise_list','cardio_zone2'));

-- 1.4 Pilares mensuales
create table program_series_pillars (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references program_series(id) on delete cascade,
  pillar_key text not null check (pillar_key in
    ('alimentacion','autoconocimiento','estres_sueno','respiraciones')),
  title text not null,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(series_id, pillar_key)
);

create table program_pillar_blocks (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references program_series_pillars(id) on delete cascade,
  block_type text not null check (block_type in
    ('text','youtube','pdf','image','exercise_list','cardio_zone2')),
  sort_order int not null,
  content jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_program_series_pillars_updated_at
  before update on program_series_pillars for each row execute function set_updated_at();
create trigger trg_program_pillar_blocks_updated_at
  before update on program_pillar_blocks for each row execute function set_updated_at();

-- RLS (espejo de program_days / program_day_blocks)
alter table program_series_pillars enable row level security;
alter table program_pillar_blocks enable row level security;

create policy "pillars_read_published"
  on program_series_pillars for select using (published = true or is_admin());
create policy "pillars_admin_write"
  on program_series_pillars for all using (is_admin());

create policy "pillar_blocks_read_published"
  on program_pillar_blocks for select using (
    exists (
      select 1 from program_series_pillars p
      where p.id = program_pillar_blocks.pillar_id
        and (p.published = true or is_admin())
    )
  );
create policy "pillar_blocks_admin_write"
  on program_pillar_blocks for all using (is_admin());

-- Bucket de Storage para PDFs/imágenes de contenido
insert into storage.buckets (id, name, public)
values ('content', 'content', true)
on conflict (id) do nothing;

-- Solo admins escriben en el bucket content; lectura pública
create policy "content_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and is_admin());
create policy "content_public_read"
  on storage.objects for select using (bucket_id = 'content');
```

- [ ] **Step 2: Apply the migration in Supabase dashboard**

Pega el contenido de `004_editor_pilares.sql` en el SQL editor del proyecto `bgvxaagfnzvzamtxqbkg` y ejecútalo.
Expected: sin errores. Si falla en un `drop constraint` por nombre, corre `\d program_days` / `\d program_day_blocks`, copia el nombre real de la constraint y ajusta el SQL.

- [ ] **Step 3: Verify**

En el SQL editor: `select * from program_series_pillars limit 1;` y `select id from storage.buckets where id='content';`
Expected: la tabla existe (0 filas) y el bucket `content` existe.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_editor_pilares.sql
git commit -m "feat: migration 004 — day_type rename, cardio_zone2 block, pillars tables, content bucket"
```

### Task 0.4: Instalar dependencias del editor

**Files:** `package.json` (modificado por npm)

- [ ] **Step 1: Install Tiptap + dnd-kit**

Run:
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
Expected: se agregan a `dependencies`, sin errores de peer deps.

- [ ] **Step 2: Verify build still compiles**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tiptap + dnd-kit for the day editor"
```

---

## FASE 1 — Subsistema E: Editor de Día

### Task 1.1: `getDayWithBlocks` + tipos

**Files:**
- Modify: `lib/admin/queries.ts`
- Test: `__tests__/admin-queries.test.ts`

- [ ] **Step 1: Write the failing test (shape only, with a mocked supabase)**

```typescript
// __tests__/admin-queries.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getDayWithBlocks } from "@/lib/admin/queries";

function mockChain(dayRow: unknown, blockRows: unknown[]) {
  return {
    from: (table: string) => {
      if (table === "program_days") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: dayRow }) }) }),
        };
      }
      // program_day_blocks
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: blockRows }) }) }),
      };
    },
  };
}

describe("getDayWithBlocks", () => {
  it("returns null when the day does not exist", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockChain(null, []));
    expect(await getDayWithBlocks("missing")).toBeNull();
  });

  it("returns the day with its ordered blocks", async () => {
    const day = {
      id: "d1", series_id: "s1", week_number: 1, day_of_week: "lunes",
      workout_focus: "Tren Inferior", title: "Piernas", description: null,
      day_type: "workout", duration_minutes: 40, published: true,
    };
    const blocks = [{ id: "b1", block_type: "text", sort_order: 0, content: { html: "<p>hi</p>" } }];
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockChain(day, blocks));
    const result = await getDayWithBlocks("d1");
    expect(result?.id).toBe("d1");
    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks[0].block_type).toBe("text");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/admin-queries.test.ts`
Expected: FAIL — `getDayWithBlocks` no existe.

- [ ] **Step 3: Implement in `lib/admin/queries.ts`** (append after existing exports)

```typescript
export interface BlockData {
  id: string;
  block_type: "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
  sort_order: number;
  content: Record<string, unknown>;
}

export interface DayWithBlocks {
  id: string;
  series_id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  description: string | null;
  day_type: string;
  duration_minutes: number | null;
  published: boolean;
  blocks: BlockData[];
}

export async function getDayWithBlocks(dayId: string): Promise<DayWithBlocks | null> {
  const supabase = await createClient();

  const { data: rawDay } = await supabase
    .from("program_days")
    .select(
      "id, series_id, week_number, day_of_week, workout_focus, title, description, day_type, duration_minutes, published"
    )
    .eq("id", dayId)
    .single();

  const day = rawDay as unknown as Omit<DayWithBlocks, "blocks"> | null;
  if (!day) return null;

  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("id, block_type, sort_order, content")
    .eq("day_id", dayId)
    .order("sort_order");

  return { ...day, blocks: (rawBlocks as unknown as BlockData[]) ?? [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/admin-queries.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/queries.ts __tests__/admin-queries.test.ts
git commit -m "feat: getDayWithBlocks query + Block/Day types"
```

### Task 1.2: Server actions `saveDay` + `saveBlocks`

**Files:**
- Create: `lib/admin/dayActions.ts`
- Test: `__tests__/day-actions.test.ts`

`saveBlocks` hace **upsert completo**: borra todos los bloques del día y reinserta la lista con su `sort_order`. Esto evita rastrear deletes/updates individuales.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/day-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string; payload?: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => {
        calls.push({ table, op: "insert", payload });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-id" }, error: null }) }) };
      },
      update: (payload: unknown) => {
        calls.push({ table, op: "update", payload });
        return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "d1" }, error: null }) }) }) };
      },
      delete: () => {
        calls.push({ table, op: "delete" });
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveDay, saveBlocks } from "@/lib/admin/dayActions";

beforeEach(() => { calls.length = 0; });

describe("saveDay", () => {
  it("inserts when no id is provided", async () => {
    const res = await saveDay({
      seriesId: "s1", weekNumber: 1, dayOfWeek: "lunes", title: "Piernas",
      workoutFocus: "Tren Inferior", dayType: "workout", durationMinutes: 40, published: false,
    });
    expect(res.dayId).toBe("new-id");
    expect(calls.find((c) => c.op === "insert")?.table).toBe("program_days");
  });

  it("updates when an id is provided", async () => {
    const res = await saveDay({
      id: "d1", seriesId: "s1", weekNumber: 1, dayOfWeek: "lunes", title: "Piernas",
      workoutFocus: null, dayType: "rest", durationMinutes: null, published: true,
    });
    expect(res.dayId).toBe("d1");
    expect(calls.find((c) => c.op === "update")?.table).toBe("program_days");
  });
});

describe("saveBlocks", () => {
  it("deletes existing blocks then inserts the new list with sort_order", async () => {
    await saveBlocks("d1", [
      { block_type: "text", content: { html: "<p>a</p>" } },
      { block_type: "cardio_zone2", content: {} },
    ]);
    expect(calls[0]).toMatchObject({ table: "program_day_blocks", op: "delete" });
    const inserted = calls.find((c) => c.op === "insert");
    expect(inserted?.table).toBe("program_day_blocks");
    expect((inserted?.payload as unknown[]).length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/day-actions.test.ts`
Expected: FAIL — `dayActions` no existe.

- [ ] **Step 3: Implement `lib/admin/dayActions.ts`**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface SaveDayInput {
  id?: string;
  seriesId: string;
  weekNumber: number;
  dayOfWeek: string;
  title: string;
  workoutFocus: string | null;
  dayType: "workout" | "rest" | "cardio";
  durationMinutes: number | null;
  published: boolean;
}

export async function saveDay(data: SaveDayInput): Promise<{ dayId: string; error?: string }> {
  const supabase = await createClient();
  const row = {
    series_id: data.seriesId,
    week_number: data.weekNumber,
    day_of_week: data.dayOfWeek,
    title: data.title,
    workout_focus: data.workoutFocus,
    day_type: data.dayType,
    duration_minutes: data.durationMinutes,
    published: data.published,
  };

  if (data.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from("program_days").update(row).eq("id", data.id).select("id").single();
    if (error) return { dayId: data.id, error: error.message };
    return { dayId: updated.id };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("program_days").insert(row).select("id").single();
  if (error) return { dayId: "", error: error.message };
  return { dayId: inserted.id };
}

export interface SaveBlockInput {
  block_type: string;
  content: Record<string, unknown>;
}

export async function saveBlocks(dayId: string, blocks: SaveBlockInput[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error: delError } = await client.from("program_day_blocks").delete().eq("day_id", dayId);
  if (delError) return { error: delError.message };

  if (blocks.length > 0) {
    const rows = blocks.map((b, i) => ({
      day_id: dayId,
      block_type: b.block_type,
      sort_order: i,
      content: b.content,
    }));
    const { error: insError } = await client.from("program_day_blocks").insert(rows);
    if (insError) return { error: insError.message };
  }

  revalidatePath("/portal/today");
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/day-actions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/dayActions.ts __tests__/day-actions.test.ts
git commit -m "feat: saveDay + saveBlocks server actions"
```

### Task 1.3: Route handler de upload

**Files:**
- Create: `app/api/admin/upload/route.ts`

- [ ] **Step 1: Implement the route**

```typescript
// app/api/admin/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  // Verifica que quien sube sea admin (RLS-aware client con la sesión del usuario)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const bucketPrefix = form.get("bucket"); // "pdfs" | "images"
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }
  const prefix = bucketPrefix === "images" ? "images" : "pdfs";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${prefix}/${Date.now()}-${safeName}`;

  const admin = createServiceClient();
  const { error } = await admin.storage.from("content").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ storage_path: path, filename: file.name });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/upload/route.ts
git commit -m "feat: /api/admin/upload route (Storage upload, admin-gated)"
```

### Task 1.4: Block editors (Text, Youtube, Pdf, Image, ExerciseList, CardioZone2)

Cada editor es un client component que recibe `content` y `onChange(content)`. No persisten; el `DayEditorForm` guarda todo junto.

**Files:**
- Create: `components/admin/blocks/TextBlockEditor.tsx`
- Create: `components/admin/blocks/YoutubeBlockEditor.tsx`
- Create: `components/admin/blocks/PdfBlockEditor.tsx`
- Create: `components/admin/blocks/ImageBlockEditor.tsx`
- Create: `components/admin/blocks/ExerciseListBlockEditor.tsx`
- Create: `components/admin/blocks/CardioZone2BlockEditor.tsx`

- [ ] **Step 1: `TextBlockEditor.tsx` (Tiptap)**

```tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Heading2, List } from "lucide-react";

export function TextBlockEditor({
  content, onChange,
}: { content: { html?: string }; onChange: (c: { html: string }) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content.html ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML() }),
  });
  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-1.5 rounded ${active ? "bg-[var(--lavanda-tint)] text-[var(--lavanda-dark)]" : "text-[var(--gris-texto)]"}`;

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--gris-linea)" }}>
      <div className="flex gap-1 p-2 border-b" style={{ borderColor: "var(--gris-linea)" }}>
        <button type="button" className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></button>
        <button type="button" className={btn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></button>
        <button type="button" className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></button>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 font-body" />
    </div>
  );
}
```

- [ ] **Step 2: `YoutubeBlockEditor.tsx`**

```tsx
"use client";
import { useState } from "react";
import { extractVideoId } from "@/lib/admin/youtube";

export function YoutubeBlockEditor({
  content, onChange,
}: {
  content: { video_id?: string; title?: string };
  onChange: (c: { video_id: string; title: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const videoId = content.video_id ?? "";

  return (
    <div className="space-y-2">
      <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
        style={{ borderColor: "var(--gris-linea)" }}
        placeholder="Pega la URL de YouTube"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          const id = extractVideoId(e.target.value);
          if (id) onChange({ video_id: id, title: content.title ?? "" });
        }} />
      <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
        style={{ borderColor: "var(--gris-linea)" }}
        placeholder="Título (opcional)"
        value={content.title ?? ""}
        onChange={(e) => onChange({ video_id: videoId, title: e.target.value })} />
      {videoId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="preview"
          className="rounded-lg" style={{ width: 200 }} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: `PdfBlockEditor.tsx` and `ImageBlockEditor.tsx`** (comparten patrón de upload)

```tsx
// components/admin/blocks/PdfBlockEditor.tsx
"use client";
import { useState } from "react";

export function PdfBlockEditor({
  content, onChange,
}: {
  content: { storage_path?: string; filename?: string; label?: string };
  onChange: (c: { storage_path: string; filename: string; label: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", "pdfs");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (json.storage_path) {
      onChange({ storage_path: json.storage_path, filename: json.filename, label: content.label ?? "Descargar PDF" });
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="application/pdf"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {uploading && <p className="text-sm font-body" style={{ color: "var(--gris-texto)" }}>Subiendo…</p>}
      {content.storage_path && (
        <>
          <p className="text-sm font-body">✓ {content.filename}</p>
          <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
            style={{ borderColor: "var(--gris-linea)" }}
            placeholder="Etiqueta del enlace"
            value={content.label ?? ""}
            onChange={(e) => onChange({
              storage_path: content.storage_path!, filename: content.filename ?? "", label: e.target.value,
            })} />
        </>
      )}
    </div>
  );
}
```

```tsx
// components/admin/blocks/ImageBlockEditor.tsx
"use client";
import { useState } from "react";

export function ImageBlockEditor({
  content, onChange,
}: {
  content: { storage_path?: string; alt?: string };
  onChange: (c: { storage_path: string; alt: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", "images");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (json.storage_path) onChange({ storage_path: json.storage_path, alt: content.alt ?? "" });
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="image/*"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {uploading && <p className="text-sm font-body" style={{ color: "var(--gris-texto)" }}>Subiendo…</p>}
      {content.storage_path && (
        <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
          style={{ borderColor: "var(--gris-linea)" }}
          placeholder="Texto alternativo (alt)"
          value={content.alt ?? ""}
          onChange={(e) => onChange({ storage_path: content.storage_path!, alt: e.target.value })} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: `ExerciseListBlockEditor.tsx`**

```tsx
"use client";
import { Trash2, Plus } from "lucide-react";

interface Exercise {
  id: string; name: string; sets: number; reps: string;
  rest_seconds: number; notes: string; video_url: string; metrics: string[];
}

export function ExerciseListBlockEditor({
  content, onChange,
}: {
  content: { exercises?: Exercise[] };
  onChange: (c: { exercises: Exercise[] }) => void;
}) {
  const exercises = content.exercises ?? [];

  const update = (next: Exercise[]) => onChange({ exercises: next });
  const setField = (i: number, patch: Partial<Exercise>) =>
    update(exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const toggleMetric = (i: number, metric: string, on: boolean) => {
    const cur = exercises[i].metrics;
    setField(i, { metrics: on ? [...new Set([...cur, metric])] : cur.filter((m) => m !== metric) });
  };
  const add = () => update([...exercises, {
    id: crypto.randomUUID(), name: "", sets: 3, reps: "12",
    rest_seconds: 60, notes: "", video_url: "", metrics: ["reps_done"],
  }]);

  const input = "rounded-lg border px-2 py-1.5 font-body text-sm";
  const border = { borderColor: "var(--gris-linea)" };

  return (
    <div className="space-y-3">
      {exercises.map((ex, i) => (
        <div key={ex.id} className="rounded-lg border p-3 space-y-2" style={border}>
          <div className="flex justify-between items-center">
            <input className={`${input} flex-1`} style={border} placeholder="Nombre del ejercicio"
              value={ex.name} onChange={(e) => setField(i, { name: e.target.value })} />
            <button type="button" onClick={() => update(exercises.filter((_, idx) => idx !== i))}
              className="ml-2 text-[var(--gris-texto)]"><Trash2 size={15} /></button>
          </div>
          <div className="flex gap-2">
            <input className={`${input} w-20`} style={border} type="number" placeholder="Series"
              value={ex.sets} onChange={(e) => setField(i, { sets: Number(e.target.value) })} />
            <input className={`${input} w-24`} style={border} placeholder="Reps"
              value={ex.reps} onChange={(e) => setField(i, { reps: e.target.value })} />
            <input className={`${input} w-28`} style={border} type="number" placeholder="Descanso (s)"
              value={ex.rest_seconds} onChange={(e) => setField(i, { rest_seconds: Number(e.target.value) })} />
          </div>
          <input className={`${input} w-full`} style={border} placeholder="Notas del coach"
            value={ex.notes} onChange={(e) => setField(i, { notes: e.target.value })} />
          <input className={`${input} w-full`} style={border} placeholder="URL de video demo (opcional)"
            value={ex.video_url} onChange={(e) => setField(i, { video_url: e.target.value })} />
          <div className="flex gap-4 text-sm font-body">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={ex.metrics.includes("reps_done")}
                onChange={(e) => toggleMetric(i, "reps_done", e.target.checked)} /> Registrar reps
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={ex.metrics.includes("weight_kg")}
                onChange={(e) => toggleMetric(i, "weight_kg", e.target.checked)} /> Registrar peso (kg)
            </label>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-sm font-body" style={{ color: "var(--lavanda-dark)" }}>
        <Plus size={15} /> Agregar ejercicio
      </button>
    </div>
  );
}
```

- [ ] **Step 5: `CardioZone2BlockEditor.tsx` (trivial)**

```tsx
"use client";
import { HeartPulse } from "lucide-react";

export function CardioZone2BlockEditor() {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3 font-body text-sm"
      style={{ borderColor: "var(--gris-linea)", color: "var(--gris-texto)" }}>
      <HeartPulse size={16} color="var(--lavanda-dark)" />
      La clienta verá la calculadora de Cardio Zona 2 (ingresa su edad → rango). No hay nada que configurar.
    </div>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/admin/blocks/
git commit -m "feat: 6 block editors (text/youtube/pdf/image/exercise_list/cardio_zone2)"
```

### Task 1.5: `DayEditorForm` con dnd-kit

**Files:**
- Create: `components/admin/DayEditorForm.tsx`

- [ ] **Step 1: Implement the form**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Plus } from "lucide-react";
import { saveDay, saveBlocks } from "@/lib/admin/dayActions";
import type { DayWithBlocks } from "@/lib/admin/queries";
import { TextBlockEditor } from "./blocks/TextBlockEditor";
import { YoutubeBlockEditor } from "./blocks/YoutubeBlockEditor";
import { PdfBlockEditor } from "./blocks/PdfBlockEditor";
import { ImageBlockEditor } from "./blocks/ImageBlockEditor";
import { ExerciseListBlockEditor } from "./blocks/ExerciseListBlockEditor";
import { CardioZone2BlockEditor } from "./blocks/CardioZone2BlockEditor";

type BlockType = "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
interface EditorBlock { key: string; block_type: BlockType; content: Record<string, unknown>; }

const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Texto", youtube: "Video YouTube", pdf: "PDF", image: "Imagen",
  exercise_list: "Lista de ejercicios", cardio_zone2: "Calculadora Cardio Zona 2",
};

const DAY_TYPE_OPTIONS: { value: "workout" | "rest" | "cardio"; label: string }[] = [
  { value: "workout", label: "Entrenamiento" },
  { value: "rest", label: "Descanso" },
  { value: "cardio", label: "Protocolo Cardiovascular" },
];

function SortableBlock({ block, children, onRemove }: {
  block: EditorBlock; children: React.ReactNode; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.key });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition,
        border: "1.5px solid var(--gris-linea)", borderRadius: 12, background: "white",
        boxShadow: "var(--shadow-card)", padding: 12, marginBottom: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button type="button" {...attributes} {...listeners} className="cursor-grab text-[var(--gris-texto)]">
            <GripVertical size={16} />
          </button>
          <span className="font-head text-sm">{BLOCK_LABELS[block.block_type]}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-[var(--gris-texto)]"><X size={16} /></button>
      </div>
      {children}
    </div>
  );
}

export function DayEditorForm({ day, seriesId, programId, weekNumber, dayOfWeek }: {
  day: DayWithBlocks | null;
  seriesId: string; programId: string; weekNumber: number; dayOfWeek: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(day?.title ?? "");
  const [workoutFocus, setWorkoutFocus] = useState(day?.workout_focus ?? "");
  const [dayType, setDayType] = useState<"workout" | "rest" | "cardio">(
    (day?.day_type as "workout" | "rest" | "cardio") ?? "workout");
  const [duration, setDuration] = useState(day?.duration_minutes?.toString() ?? "");
  const [published, setPublished] = useState(day?.published ?? false);
  const [blocks, setBlocks] = useState<EditorBlock[]>(
    (day?.blocks ?? []).map((b) => ({ key: b.id, block_type: b.block_type as BlockType, content: b.content })));
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const addBlock = (t: BlockType) => {
    setBlocks([...blocks, { key: crypto.randomUUID(), block_type: t, content: {} }]);
    setMenuOpen(false);
  };
  const updateBlock = (key: string, content: Record<string, unknown>) =>
    setBlocks(blocks.map((b) => (b.key === key ? { ...b, content } : b)));
  const removeBlock = (key: string) => setBlocks(blocks.filter((b) => b.key !== key));

  const onDragEnd = (e: { active: { id: string | number }; over: { id: string | number } | null }) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldI = blocks.findIndex((b) => b.key === e.active.id);
    const newI = blocks.findIndex((b) => b.key === e.over!.id);
    const next = [...blocks];
    const [moved] = next.splice(oldI, 1);
    next.splice(newI, 0, moved);
    setBlocks(next);
  };

  async function handleSave() {
    setSaving(true);
    const { dayId, error } = await saveDay({
      id: day?.id, seriesId, weekNumber, dayOfWeek, title,
      workoutFocus: workoutFocus.trim() === "" ? null : workoutFocus,
      dayType, durationMinutes: duration === "" ? null : Number(duration), published,
    });
    if (error) { setSaving(false); alert("Error: " + error); return; }
    await saveBlocks(dayId, blocks.map((b) => ({ block_type: b.block_type, content: b.content })));
    setSaving(false);
    router.push(`/admin/content/${programId}`);
    router.refresh();
  }

  function renderEditor(b: EditorBlock) {
    switch (b.block_type) {
      case "text": return <TextBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "youtube": return <YoutubeBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "pdf": return <PdfBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "image": return <ImageBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "exercise_list": return <ExerciseListBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "cardio_zone2": return <CardioZone2BlockEditor />;
    }
  }

  const field = "w-full rounded-lg border px-3 py-2 font-body text-sm";
  const border = { borderColor: "var(--gris-linea)" };

  return (
    <div className="max-w-2xl">
      <p className="font-body text-sm mb-4" style={{ color: "var(--gris-texto)" }}>
        Semana {weekNumber} — {dayOfWeek}
      </p>

      <div className="space-y-3 mb-6">
        <input className={field} style={border} placeholder="Título del día"
          value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={field} style={border} placeholder="Enfoque (opcional, ej. Tren Inferior)"
          value={workoutFocus} onChange={(e) => setWorkoutFocus(e.target.value)} />
        <select className={field} style={border} value={dayType}
          onChange={(e) => setDayType(e.target.value as "workout" | "rest" | "cardio")}>
          {DAY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className={field} style={border} type="number" placeholder="Duración (min, opcional)"
          value={duration} onChange={(e) => setDuration(e.target.value)} />
        <label className="flex items-center gap-2 font-body text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publicado
        </label>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
          {blocks.map((b) => (
            <SortableBlock key={b.key} block={b} onRemove={() => removeBlock(b.key)}>
              {renderEditor(b)}
            </SortableBlock>
          ))}
        </SortableContext>
      </DndContext>

      <div className="relative mb-6">
        <button type="button" onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>
          <Plus size={16} /> Agregar bloque
        </button>
        {menuOpen && (
          <div className="absolute z-10 mt-1 rounded-lg border bg-white shadow-md" style={border}>
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
              <button key={t} type="button" onClick={() => addBlock(t)}
                className="block w-full text-left px-4 py-2 font-body text-sm hover:bg-[var(--lavanda-tint)]">
                {BLOCK_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
        className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50"
        style={{ background: "var(--lavanda)" }}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/admin/DayEditorForm.tsx
git commit -m "feat: DayEditorForm with metadata + draggable blocks (dnd-kit)"
```

### Task 1.6: Rutas `new` y `[dayId]`

**Files:**
- Create: `app/admin/content/[programId]/series/[seriesId]/days/new/page.tsx`
- Create: `app/admin/content/[programId]/series/[seriesId]/days/[dayId]/page.tsx`

- [ ] **Step 1: Ruta `new`**

```tsx
// .../days/new/page.tsx
import { DayEditorForm } from "@/components/admin/DayEditorForm";

export default async function NewDayPage({
  params, searchParams,
}: {
  params: Promise<{ programId: string; seriesId: string }>;
  searchParams: Promise<{ week?: string; dow?: string }>;
}) {
  const { programId, seriesId } = await params;
  const { week, dow } = await searchParams;
  return (
    <div className="p-6">
      <h1 className="font-head text-xl mb-4">Nuevo día</h1>
      <DayEditorForm day={null} seriesId={seriesId} programId={programId}
        weekNumber={Number(week ?? 1)} dayOfWeek={dow ?? "lunes"} />
    </div>
  );
}
```

- [ ] **Step 2: Ruta `[dayId]`**

```tsx
// .../days/[dayId]/page.tsx
import { notFound } from "next/navigation";
import { getDayWithBlocks } from "@/lib/admin/queries";
import { DayEditorForm } from "@/components/admin/DayEditorForm";

export default async function EditDayPage({
  params,
}: {
  params: Promise<{ programId: string; seriesId: string; dayId: string }>;
}) {
  const { programId, seriesId, dayId } = await params;
  const day = await getDayWithBlocks(dayId);
  if (!day) notFound();
  return (
    <div className="p-6">
      <h1 className="font-head text-xl mb-4">Editar día</h1>
      <DayEditorForm day={day} seriesId={seriesId} programId={programId}
        weekNumber={day.week_number} dayOfWeek={day.day_of_week} />
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/content/[programId]/series/[seriesId]/days/"
git commit -m "feat: day editor routes (new + edit)"
```

### Task 1.7: Renderer portal de Cardio Zona 2 + descanso editable + badge

**Files:**
- Create: `components/portal/blocks/CardioZone2Block.tsx`
- Modify: `lib/content/queries.ts` (unión de `block_type`)
- Modify: `components/portal/TodayView.tsx`

- [ ] **Step 1: `CardioZone2Block.tsx`**

```tsx
"use client";
import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { cardioZone2 } from "@/lib/content/cardio";

export function CardioZone2Block() {
  const [edad, setEdad] = useState("");
  const { suelo, cielo } = cardioZone2(Number(edad));

  return (
    <div className="mb-6 rounded-xl p-4" style={{ background: "var(--lavanda-tint)" }}>
      <div className="flex items-center gap-2 mb-3 font-head" style={{ color: "var(--lavanda-dark)" }}>
        <HeartPulse size={18} /> Calculadora Cardio Zona 2
      </div>
      <label className="block font-body text-sm mb-1">Tu edad (años)</label>
      <input type="number" inputMode="numeric" value={edad}
        onChange={(e) => setEdad(e.target.value)}
        className="rounded-lg border px-3 py-2 font-body text-sm w-32"
        style={{ borderColor: "var(--gris-linea)" }} />
      {suelo !== null && cielo !== null && (
        <p className="mt-3 font-body text-sm" style={{ color: "var(--negro)" }}>
          Tu Cardio zona 2 se encuentra en el rango: <strong>{suelo} – {cielo}</strong>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the `DayBlock` union in `lib/content/queries.ts`**

```typescript
export interface DayBlock {
  id: string;
  block_type: "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
  sort_order: number;
  content: Record<string, unknown>;
}
```

- [ ] **Step 3: Wire the new block + editable rest day in `TodayView.tsx`**

En `BlockRenderer` (el `switch`), agrega el caso (importa el componente arriba: `import { CardioZone2Block } from "./blocks/CardioZone2Block";`):

```tsx
    case "cardio_zone2":
      return <CardioZone2Block />;
```

Cambia la condición de descanso (líneas ~370). Hoy:
```tsx
{content.day.workout_focus === null ? (
  <RestDayCard />
) : content.blocks.length === 0 ? (
```
Reemplázala por (un día de descanso **con** bloques renderiza su contenido; solo se muestra la card genérica si es descanso **sin** bloques):
```tsx
{content.day.day_type === "rest" && content.blocks.length === 0 ? (
  <RestDayCard />
) : content.blocks.length === 0 ? (
```

- [ ] **Step 4: Add a `day_type` badge in `DayHeader`**

Dentro de `DayHeader`, junto al tag de `workoutFocus`, agrega un badge para descanso/cardio:

```tsx
        {dayType === "cardio" && (
          <span className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
            style={{ fontSize: 12.5, fontWeight: 600, background: "var(--lavanda-tint)", color: "var(--lavanda-dark)" }}>
            Protocolo Cardiovascular
          </span>
        )}
        {dayType === "rest" && (
          <span className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
            style={{ fontSize: 12.5, fontWeight: 600, background: "var(--rosa-soft)", color: "#5e3d38" }}>
            Descanso
          </span>
        )}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/portal/blocks/CardioZone2Block.tsx components/portal/TodayView.tsx lib/content/queries.ts
git commit -m "feat: portal cardio_zone2 renderer + editable rest days + day_type badge"
```

---

## FASE 2 — Subsistema F: Gestión de contenido + Pilares

### Task 2.1: Server actions `cloneDay` / `cloneWeek` / `deleteDay`

**Files:**
- Modify: `lib/admin/dayActions.ts`
- Test: `__tests__/day-clone.test.ts`

`cloneDay` copia metadata + bloques a una celda destino (misma serie). Si el destino existe y `overwrite` es false → error. `cloneWeek` clona cada día de una semana origen a la misma posición en una semana destino. `deleteDay` borra la fila (los bloques caen por `on delete cascade` — confirmar que el FK lo tiene; si no, borrar bloques antes).

> Nota: el FK `program_day_blocks.day_id` no declara `on delete cascade` en el esquema original. Por eso `deleteDay` borra explícitamente los bloques primero.

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/day-clone.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

let dayRows: Record<string, unknown>[] = [];
let blockRows: Record<string, unknown>[] = [];
const inserted: { table: string; payload: unknown }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => ({
          eq: () => ({ single: () => Promise.resolve({ data: dayRows[0] ?? null }) }),
          order: () => Promise.resolve({ data: blockRows }),
          single: () => Promise.resolve({ data: dayRows.find((d) => d[col] === val) ?? null }),
          then: undefined,
        }),
      }),
      insert: (payload: unknown) => {
        inserted.push({ table, payload });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "clone-id" }, error: null }) }) };
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteDay } from "@/lib/admin/dayActions";

beforeEach(() => { dayRows = []; blockRows = []; inserted.length = 0; });

describe("deleteDay", () => {
  it("deletes blocks then the day without error", async () => {
    const res = await deleteDay("d1");
    expect(res.error).toBeUndefined();
  });
});
```

> Nota: `cloneDay`/`cloneWeek` se validan en el smoke test manual (Task 3) por la complejidad del mock de selects encadenados; el test automatizado cubre `deleteDay` y la lógica de copia se mantiene simple y lineal.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/day-clone.test.ts`
Expected: FAIL — `deleteDay` no existe.

- [ ] **Step 3: Implement (append to `lib/admin/dayActions.ts`)**

```typescript
export async function deleteDay(dayId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error: blockErr } = await client.from("program_day_blocks").delete().eq("day_id", dayId);
  if (blockErr) return { error: blockErr.message };
  const { error } = await client.from("program_days").delete().eq("id", dayId);
  if (error) return { error: error.message };
  revalidatePath("/admin/content");
  return {};
}

export async function cloneDay(
  sourceDayId: string,
  target: { seriesId: string; weekNumber: number; dayOfWeek: string },
  overwrite: boolean
): Promise<{ dayId?: string; error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // 1. Leer el día origen + sus bloques
  const { data: src } = await client.from("program_days")
    .select("week_number, day_of_week, workout_focus, title, description, day_type, duration_minutes, published")
    .eq("id", sourceDayId).single();
  if (!src) return { error: "Día origen no encontrado" };

  const { data: srcBlocks } = await client.from("program_day_blocks")
    .select("block_type, sort_order, content").eq("day_id", sourceDayId).order("sort_order");

  // 2. ¿Existe ya un día en la celda destino?
  const { data: existing } = await client.from("program_days")
    .select("id").eq("series_id", target.seriesId)
    .eq("week_number", target.weekNumber).eq("day_of_week", target.dayOfWeek).maybeSingle();

  if (existing && !overwrite) return { error: "La celda destino ya tiene un día" };
  if (existing) { await deleteDay(existing.id); }

  // 3. Insertar el día clonado
  const { data: newDay, error } = await client.from("program_days").insert({
    series_id: target.seriesId,
    week_number: target.weekNumber,
    day_of_week: target.dayOfWeek,
    workout_focus: src.workout_focus,
    title: src.title,
    description: src.description,
    day_type: src.day_type,
    duration_minutes: src.duration_minutes,
    published: src.published,
  }).select("id").single();
  if (error) return { error: error.message };

  // 4. Clonar bloques
  if (srcBlocks && srcBlocks.length > 0) {
    await client.from("program_day_blocks").insert(
      srcBlocks.map((b: { block_type: string; sort_order: number; content: unknown }) => ({
        day_id: newDay.id, block_type: b.block_type, sort_order: b.sort_order, content: b.content,
      }))
    );
  }
  revalidatePath("/admin/content");
  return { dayId: newDay.id };
}

export async function cloneWeek(
  seriesId: string, sourceWeek: number, targetWeek: number, overwrite: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: days } = await (supabase as any).from("program_days")
    .select("id, day_of_week").eq("series_id", seriesId).eq("week_number", sourceWeek);
  if (!days || days.length === 0) return { error: "La semana origen no tiene días" };

  for (const d of days as { id: string; day_of_week: string }[]) {
    const res = await cloneDay(d.id, { seriesId, weekNumber: targetWeek, dayOfWeek: d.day_of_week }, overwrite);
    if (res.error) return { error: res.error };
  }
  return {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/day-clone.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/dayActions.ts __tests__/day-clone.test.ts
git commit -m "feat: cloneDay / cloneWeek / deleteDay server actions"
```

### Task 2.2: Acciones de día en `WeeklyGrid`

**Files:**
- Modify: `components/admin/WeeklyGrid.tsx`

> Lee primero el archivo completo para respetar su estructura actual (celdas con link a `days/new` y `days/[dayId]`). El objetivo es agregar, en cada celda con día, un menú con "Clonar a…", "Eliminar"; y por fila de semana un botón "Clonar semana a…". Como `WeeklyGrid` probablemente es server component, extrae las acciones a un pequeño client component.

- [ ] **Step 1: Create `components/admin/DayCellMenu.tsx` (client)**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { cloneDay, deleteDay } from "@/lib/admin/dayActions";

const DOWS = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"];

export function DayCellMenu({ dayId, seriesId }: { dayId: string; seriesId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar este día y su contenido?")) return;
    const { error } = await deleteDay(dayId);
    if (error) alert("Error: " + error);
    else router.refresh();
  }

  async function handleClone() {
    const week = Number(prompt("Semana destino (1-4)?"));
    const dow = prompt(`Día destino (${DOWS.join(", ")})?`);
    if (!week || !dow || !DOWS.includes(dow)) return;
    const { error } = await cloneDay(dayId, { seriesId, weekNumber: week, dayOfWeek: dow }, false);
    if (error) {
      if (confirm(error + ". ¿Sobrescribir?")) {
        const retry = await cloneDay(dayId, { seriesId, weekNumber: week, dayOfWeek: dow }, true);
        if (retry.error) { alert("Error: " + retry.error); return; }
      } else return;
    }
    router.refresh();
  }

  return (
    <div className="relative inline-block">
      <button type="button" onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        className="text-[var(--gris-texto)]"><MoreVertical size={14} /></button>
      {open && (
        <div className="absolute z-10 right-0 mt-1 rounded-lg border bg-white shadow-md text-sm font-body"
          style={{ borderColor: "var(--gris-linea)" }}>
          <button type="button" onClick={handleClone}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap">Clonar a…</button>
          <button type="button" onClick={handleDelete}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap"
            style={{ color: "#e05c5c" }}>Eliminar</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render `DayCellMenu` inside each filled cell of `WeeklyGrid.tsx`**

En la celda que ya muestra un día existente, agrega el menú pasando `dayId` y el `seriesId` de la serie. Importa: `import { DayCellMenu } from "./DayCellMenu";`. Coloca `<DayCellMenu dayId={day.id} seriesId={seriesId} />` en una esquina de la celda. Asegúrate de que `WeeklyGrid` reciba `seriesId` como prop (si no lo tiene, agrégalo desde `SeriesAccordion`).

- [ ] **Step 3: Add "Clonar semana a…" — create `components/admin/CloneWeekButton.tsx` (client)**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { cloneWeek } from "@/lib/admin/dayActions";

export function CloneWeekButton({ seriesId, week }: { seriesId: string; week: number }) {
  const router = useRouter();
  async function handle() {
    const target = Number(prompt(`Clonar semana ${week} a qué semana (1-4)?`));
    if (!target || target === week) return;
    const { error } = await cloneWeek(seriesId, week, target, false);
    if (error) {
      if (confirm(error + ". ¿Sobrescribir los días existentes?")) {
        const retry = await cloneWeek(seriesId, week, target, true);
        if (retry.error) { alert("Error: " + retry.error); return; }
      } else return;
    }
    router.refresh();
  }
  return (
    <button type="button" onClick={handle}
      className="flex items-center gap-1 font-body text-xs" style={{ color: "var(--lavanda-dark)" }}>
      <Copy size={12} /> Clonar semana
    </button>
  );
}
```

Renderiza `<CloneWeekButton seriesId={seriesId} week={n} />` al inicio de cada fila de semana en `WeeklyGrid.tsx`.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/admin/WeeklyGrid.tsx components/admin/DayCellMenu.tsx components/admin/CloneWeekButton.tsx components/admin/SeriesAccordion.tsx
git commit -m "feat: clone/delete day + clone week actions in the weekly grid"
```

### Task 2.3: Queries y server actions de pilares

**Files:**
- Modify: `lib/admin/queries.ts` — `getSeriesPillars`, `getPillarWithBlocks`.
- Create: `lib/admin/pillarActions.ts` — `savePillar`, `savePillarBlocks`.
- Test: `__tests__/pillar-actions.test.ts`

Los 4 pilares son un conjunto fijo. `getSeriesPillars` devuelve siempre los 4 (creados o no) para que el admin pueda crear cualquiera.

- [ ] **Step 1: Add constants + admin queries to `lib/admin/queries.ts`**

```typescript
export const PILLARS = [
  { key: "alimentacion", name: "Alimentación con intención" },
  { key: "autoconocimiento", name: "Autoconocimiento" },
  { key: "estres_sueno", name: "Manejo de estrés, descanso y sueño" },
  { key: "respiraciones", name: "Respiraciones y suelo pélvico" },
] as const;

export interface PillarRow {
  pillar_key: string;
  name: string;
  id: string | null;
  title: string | null;
  published: boolean;
}

export async function getSeriesPillars(seriesId: string): Promise<PillarRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_series_pillars")
    .select("id, pillar_key, title, published")
    .eq("series_id", seriesId);
  const existing = (data as unknown as { id: string; pillar_key: string; title: string; published: boolean }[]) ?? [];
  return PILLARS.map((p) => {
    const row = existing.find((e) => e.pillar_key === p.key);
    return { pillar_key: p.key, name: p.name, id: row?.id ?? null, title: row?.title ?? null, published: row?.published ?? false };
  });
}

export async function getPillarWithBlocks(seriesId: string, pillarKey: string): Promise<{
  id: string | null; pillar_key: string; title: string; published: boolean; blocks: BlockData[];
}> {
  const supabase = await createClient();
  const { data: rawPillar } = await supabase
    .from("program_series_pillars")
    .select("id, pillar_key, title, published")
    .eq("series_id", seriesId).eq("pillar_key", pillarKey).maybeSingle();

  const pillar = rawPillar as unknown as { id: string; pillar_key: string; title: string; published: boolean } | null;
  const name = PILLARS.find((p) => p.key === pillarKey)?.name ?? pillarKey;
  if (!pillar) return { id: null, pillar_key: pillarKey, title: name, published: false, blocks: [] };

  const { data: rawBlocks } = await supabase
    .from("program_pillar_blocks")
    .select("id, block_type, sort_order, content")
    .eq("pillar_id", pillar.id).order("sort_order");

  return { ...pillar, blocks: (rawBlocks as unknown as BlockData[]) ?? [] };
}
```

- [ ] **Step 2: Write the failing test for `savePillar`**

```typescript
// __tests__/pillar-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string }[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      upsert: () => { calls.push({ table, op: "upsert" });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "p1" }, error: null }) }) }; },
      delete: () => { calls.push({ table, op: "delete" }); return { eq: () => Promise.resolve({ error: null }) }; },
      insert: () => { calls.push({ table, op: "insert" }); return Promise.resolve({ error: null }); },
    }),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { savePillar } from "@/lib/admin/pillarActions";

beforeEach(() => { calls.length = 0; });

describe("savePillar", () => {
  it("upserts the pillar and returns its id", async () => {
    const res = await savePillar({ seriesId: "s1", pillarKey: "alimentacion", title: "Mes 1", published: true });
    expect(res.pillarId).toBe("p1");
    expect(calls[0]).toMatchObject({ table: "program_series_pillars", op: "upsert" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/pillar-actions.test.ts`
Expected: FAIL — `pillarActions` no existe.

- [ ] **Step 4: Implement `lib/admin/pillarActions.ts`**

```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SaveBlockInput } from "./dayActions";

export async function savePillar(data: {
  seriesId: string; pillarKey: string; title: string; published: boolean;
}): Promise<{ pillarId: string; error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("program_series_pillars")
    .upsert(
      { series_id: data.seriesId, pillar_key: data.pillarKey, title: data.title, published: data.published },
      { onConflict: "series_id,pillar_key" }
    )
    .select("id").single();
  if (error) return { pillarId: "", error: error.message };
  return { pillarId: row.id };
}

export async function savePillarBlocks(pillarId: string, blocks: SaveBlockInput[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error: delErr } = await client.from("program_pillar_blocks").delete().eq("pillar_id", pillarId);
  if (delErr) return { error: delErr.message };
  if (blocks.length > 0) {
    const { error } = await client.from("program_pillar_blocks").insert(
      blocks.map((b, i) => ({ pillar_id: pillarId, block_type: b.block_type, sort_order: i, content: b.content }))
    );
    if (error) return { error: error.message };
  }
  revalidatePath("/portal/pilares");
  return {};
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/pillar-actions.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add lib/admin/queries.ts lib/admin/pillarActions.ts __tests__/pillar-actions.test.ts
git commit -m "feat: pillar queries + savePillar/savePillarBlocks actions"
```

### Task 2.4: Editor de pilar (admin) + reuso de bloques

`DayEditorForm` ya contiene toda la lógica de bloques + dnd. Para no duplicar, extrae la sección de bloques a un componente reutilizable `BlockListEditor` y haz que `DayEditorForm` y un nuevo `PillarEditorForm` lo usen.

**Files:**
- Create: `components/admin/BlockListEditor.tsx` (extraído de `DayEditorForm`)
- Modify: `components/admin/DayEditorForm.tsx` (usar `BlockListEditor`)
- Create: `components/admin/PillarEditorForm.tsx`
- Create: `app/admin/content/[programId]/series/[seriesId]/pillars/page.tsx`
- Create: `app/admin/content/[programId]/series/[seriesId]/pillars/[pillarKey]/page.tsx`
- Modify: `components/admin/SeriesAccordion.tsx` (link "Pilares")

- [ ] **Step 1: Extract `BlockListEditor.tsx`**

Mueve a este archivo el tipo `EditorBlock`, `BLOCK_LABELS`, `SortableBlock`, el `DndContext`/`SortableContext`, el botón "Agregar bloque" y `renderEditor`. Expón:

```tsx
"use client";
// ...imports de dnd-kit, blocks (igual que en DayEditorForm)...
export type BlockType = "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
export interface EditorBlock { key: string; block_type: BlockType; content: Record<string, unknown>; }

export function BlockListEditor({ blocks, setBlocks }: {
  blocks: EditorBlock[];
  setBlocks: (b: EditorBlock[]) => void;
}) {
  // ...todo el JSX de dnd + menú "Agregar bloque" + renderEditor que estaba en DayEditorForm...
}
```

Luego en `DayEditorForm.tsx` reemplaza el bloque dnd/menu por `<BlockListEditor blocks={blocks} setBlocks={setBlocks} />` e importa `EditorBlock`/`BlockType` desde `BlockListEditor`.

- [ ] **Step 2: `PillarEditorForm.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BlockListEditor, type EditorBlock } from "./BlockListEditor";
import { savePillar, savePillarBlocks } from "@/lib/admin/pillarActions";

export function PillarEditorForm({ seriesId, programId, pillarKey, pillarName, pillar }: {
  seriesId: string; programId: string; pillarKey: string; pillarName: string;
  pillar: { id: string | null; title: string; published: boolean; blocks: { id: string; block_type: string; content: Record<string, unknown> }[] };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(pillar.title);
  const [published, setPublished] = useState(pillar.published);
  const [blocks, setBlocks] = useState<EditorBlock[]>(
    pillar.blocks.map((b) => ({ key: b.id, block_type: b.block_type as EditorBlock["block_type"], content: b.content })));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { pillarId, error } = await savePillar({ seriesId, pillarKey, title, published });
    if (error) { setSaving(false); alert("Error: " + error); return; }
    await savePillarBlocks(pillarId, blocks.map((b) => ({ block_type: b.block_type, content: b.content })));
    setSaving(false);
    router.push(`/admin/content/${programId}/series/${seriesId}/pillars`);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-head text-xl mb-1">{pillarName}</h1>
      <input className="w-full rounded-lg border px-3 py-2 font-body text-sm mb-3"
        style={{ borderColor: "var(--gris-linea)" }} placeholder="Título"
        value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center gap-2 font-body text-sm mb-6">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicado
      </label>
      <BlockListEditor blocks={blocks} setBlocks={setBlocks} />
      <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
        className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50 mt-4"
        style={{ background: "var(--lavanda)" }}>{saving ? "Guardando…" : "Guardar"}</button>
    </div>
  );
}
```

- [ ] **Step 3: Lista de pilares `pillars/page.tsx`**

```tsx
import Link from "next/link";
import { getSeriesPillars } from "@/lib/admin/queries";

export default async function PillarsPage({
  params,
}: {
  params: Promise<{ programId: string; seriesId: string }>;
}) {
  const { programId, seriesId } = await params;
  const pillars = await getSeriesPillars(seriesId);
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-head text-xl mb-4">Pilares del mes</h1>
      <div className="space-y-2">
        {pillars.map((p) => (
          <Link key={p.pillar_key}
            href={`/admin/content/${programId}/series/${seriesId}/pillars/${p.pillar_key}`}
            className="flex items-center justify-between rounded-lg border px-4 py-3 font-body"
            style={{ borderColor: "var(--gris-linea)" }}>
            <span>{p.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: p.published ? "var(--lavanda-tint)" : "#f0f0f0",
                color: p.published ? "var(--lavanda-dark)" : "var(--gris-texto)" }}>
              {p.id ? (p.published ? "Publicado" : "Borrador") : "Sin crear"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Editor de pilar `pillars/[pillarKey]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getPillarWithBlocks, PILLARS } from "@/lib/admin/queries";
import { PillarEditorForm } from "@/components/admin/PillarEditorForm";

export default async function PillarEditPage({
  params,
}: {
  params: Promise<{ programId: string; seriesId: string; pillarKey: string }>;
}) {
  const { programId, seriesId, pillarKey } = await params;
  if (!PILLARS.some((p) => p.key === pillarKey)) notFound();
  const pillar = await getPillarWithBlocks(seriesId, pillarKey);
  const pillarName = PILLARS.find((p) => p.key === pillarKey)!.name;
  return (
    <div className="p-6">
      <PillarEditorForm seriesId={seriesId} programId={programId}
        pillarKey={pillarKey} pillarName={pillarName} pillar={pillar} />
    </div>
  );
}
```

- [ ] **Step 5: Link "Pilares" en `SeriesAccordion.tsx` (solo CuarentaMás/Extra)**

Lee el archivo. Donde recibe el `program` (o su `slug`), agrega, junto al header de cada serie, un link condicional:

```tsx
{(programSlug === "cuarenta-mas" || programSlug === "cuarenta-mas-extra") && (
  <Link href={`/admin/content/${programId}/series/${series.id}/pillars`}
    className="font-body text-xs" style={{ color: "var(--lavanda-dark)" }}>
    Pilares del mes
  </Link>
)}
```

Asegúrate de pasar `programSlug` y `programId` como props a `SeriesAccordion` desde `app/admin/content/[programId]/page.tsx` si aún no llegan.

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/admin/BlockListEditor.tsx components/admin/DayEditorForm.tsx components/admin/PillarEditorForm.tsx components/admin/SeriesAccordion.tsx "app/admin/content/[programId]/series/[seriesId]/pillars/"
git commit -m "feat: pillar admin editor reusing BlockListEditor"
```

### Task 2.5: Portal — sección de pilares

**Files:**
- Create: `components/portal/blocks/BlockView.tsx` — renderer read-only reutilizable.
- Create: `lib/content/pillars.ts` — `getCurrentMonthPillars(userId)`.
- Create: `components/portal/PillarsView.tsx`.
- Create: `app/portal/pilares/page.tsx`.
- Test: `__tests__/pillars-access.test.ts`.

`getCurrentMonthPillars` reusa la lógica de suscripción de `getTodayContent`: programa debe ser CuarentaMás/Extra; serie = `months_elapsed`; devuelve solo pilares `published`. Para Strong & Fit devuelve `[]`.

- [ ] **Step 1: `BlockView.tsx` — extrae el render read-only de un bloque**

Reusa los componentes existentes de `components/portal/blocks/` (`TextBlock`, `YoutubeBlock`, `PdfBlock`, `ImageBlock`) más `CardioZone2Block`. `exercise_list` en pilares se renderiza informativo (sin formulario de progreso).

```tsx
"use client";
import { TextBlock } from "./TextBlock";
import { YoutubeBlock } from "./YoutubeBlock";
import { PdfBlock } from "./PdfBlock";
import { ImageBlock } from "./ImageBlock";
import { CardioZone2Block } from "./CardioZone2Block";

export interface ViewBlock { id: string; block_type: string; content: Record<string, unknown>; }

export function BlockView({ block }: { block: ViewBlock }) {
  switch (block.block_type) {
    case "text": return <TextBlock content={block.content as { html: string }} />;
    case "youtube": return <YoutubeBlock content={block.content as { video_id: string; title: string }} />;
    case "pdf": return <PdfBlock content={block.content as { storage_path: string; filename: string; label: string }} />;
    case "image": return <ImageBlock content={block.content as { storage_path: string; alt: string }} />;
    case "cardio_zone2": return <CardioZone2Block />;
    default: return null;
  }
}
```

> Verifica las props exactas que esperan `PdfBlock` e `ImageBlock` (cómo resuelven el `storage_path` a URL pública). Ajusta el cast si difieren.

- [ ] **Step 2: Write the failing test for the gate**

```typescript
// __tests__/pillars-access.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";

function mockSub(slug: string) {
  return {
    from: (table: string) => {
      if (table === "subscriptions") {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () =>
          Promise.resolve({ data: {
            months_elapsed: 1, program_variant_id: "v1",
            program_variants: { program_id: "pr1", programs: { slug } },
          } }) }) }) }) };
      }
      if (table === "variant_series_map") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [
          { series_id: "s1", program_series: { series_number: 1 } },
        ] }) }) };
      }
      // program_series_pillars
      return { select: () => ({ eq: () => ({ eq: () => ({ order: () =>
        Promise.resolve({ data: [] }) }) }) }) };
    },
  };
}

describe("getCurrentMonthPillars", () => {
  it("returns [] for a non-CuarentaMás program", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSub("strong-fit"));
    expect(await getCurrentMonthPillars("u1")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/pillars-access.test.ts`
Expected: FAIL — `getCurrentMonthPillars` no existe.

- [ ] **Step 4: Implement `lib/content/pillars.ts`**

```typescript
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface PillarWithBlocks {
  id: string; pillar_key: string; title: string;
  blocks: { id: string; block_type: string; sort_order: number; content: Record<string, unknown> }[];
}

const ALLOWED = new Set(["cuarenta-mas", "cuarenta-mas-extra"]);

export async function getCurrentMonthPillars(userId: string): Promise<PillarWithBlocks[]> {
  const supabase = await createClient();

  const { data: rawSub } = await supabase
    .from("subscriptions")
    .select(`months_elapsed, program_variant_id,
      program_variants!inner ( program_id, programs!inner ( slug ) )`)
    .eq("profile_id", userId).eq("status", "active").single();

  const sub = rawSub as unknown as {
    months_elapsed: number; program_variant_id: string;
    program_variants: { program_id: string; programs: { slug: string } };
  } | null;
  if (!sub) return [];
  if (!ALLOWED.has(sub.program_variants.programs.slug)) return [];

  const { data: rawMap } = await supabase
    .from("variant_series_map")
    .select("series_id, program_series!inner ( series_number )")
    .eq("program_variant_id", sub.program_variant_id);
  const map = rawMap as unknown as { series_id: string; program_series: { series_number: number } }[] | null;
  const seriesEntry = map?.find((m) => m.program_series.series_number === sub.months_elapsed);
  if (!seriesEntry) return [];

  const { data: rawPillars } = await supabase
    .from("program_series_pillars")
    .select("id, pillar_key, title")
    .eq("series_id", seriesEntry.series_id).eq("published", true).order("sort_order");
  const pillars = (rawPillars as unknown as { id: string; pillar_key: string; title: string }[]) ?? [];
  if (pillars.length === 0) return [];

  const { data: rawBlocks } = await supabase
    .from("program_pillar_blocks")
    .select("id, pillar_id, block_type, sort_order, content")
    .in("pillar_id", pillars.map((p) => p.id)).order("sort_order");
  const blocks = (rawBlocks as unknown as { id: string; pillar_id: string; block_type: string; sort_order: number; content: Record<string, unknown> }[]) ?? [];

  return pillars.map((p) => ({
    ...p,
    blocks: blocks.filter((b) => b.pillar_id === p.id).map(({ pillar_id: _pid, ...rest }) => rest),
  }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/pillars-access.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: `PillarsView.tsx` (acordeón)**

```tsx
"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BlockView } from "./blocks/BlockView";
import type { PillarWithBlocks } from "@/lib/content/pillars";

export function PillarsView({ pillars }: { pillars: PillarWithBlocks[] }) {
  const [open, setOpen] = useState<string | null>(pillars[0]?.id ?? null);
  if (pillars.length === 0) {
    return <p className="font-body text-center py-12" style={{ color: "var(--gris-texto)" }}>
      Este mes no tiene pilares adicionales.</p>;
  }
  return (
    <div className="px-4 pt-4 pb-8 space-y-3">
      <h1 className="font-head text-2xl mb-2">Pilares del mes</h1>
      {pillars.map((p) => (
        <div key={p.id} className="rounded-xl border bg-white" style={{ borderColor: "var(--gris-linea)" }}>
          <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)}
            className="flex w-full items-center justify-between p-4 font-head text-left">
            {p.title}
            <ChevronDown size={18} style={{ transform: open === p.id ? "rotate(180deg)" : "none" }} />
          </button>
          {open === p.id && (
            <div className="px-4 pb-4">
              {p.blocks.map((b) => <BlockView key={b.id} block={b} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: `app/portal/pilares/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";
import { PillarsView } from "@/components/portal/PillarsView";

export default async function PilaresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const pillars = await getCurrentMonthPillars(user.id);
  return <PillarsView pillars={pillars} />;
}
```

- [ ] **Step 8: Nav condicional en el portal**

En `app/portal/layout.tsx` (nav inferior), agrega un ítem "Pilares" → `/portal/pilares`. Para mostrarlo solo a CuarentaMás/Extra, consulta el slug del programa activo en el layout (server) y renderiza el ítem condicionalmente. Si el layout ya no hace esa consulta, agrégala con el mismo patrón de `getCurrentMonthPillars` (select de `subscriptions` con slug) y condiciona el ítem.

- [ ] **Step 9: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 10: Commit**

```bash
git add components/portal/blocks/BlockView.tsx components/portal/PillarsView.tsx lib/content/pillars.ts app/portal/pilares/ app/portal/layout.tsx __tests__/pillars-access.test.ts
git commit -m "feat: portal pillars section (current month, CuarentaMás/Extra only)"
```

---

## FASE 3 — Verificación de cierre de Fase 2

### Task 3.1: Suite completa + typecheck

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS todos (los 25 previos + los nuevos: cardio, youtube, admin-queries, day-actions, day-clone, pillar-actions, pillars-access).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpio.

### Task 3.2: Smoke test manual

Con `npm run dev` y un usuario admin (y un usuario cliente con suscripción CuarentaMás activa; usar `DEV_DATE` si hace falta posicionar la semana/día):

- [ ] **Editor:** `/admin/content` → un programa → serie → celda vacía → crear día con los **6 tipos de bloque** → reordenar con drag → marcar publicado → Guardar. Verifica que vuelve a la grilla y la celda aparece publicada.
- [ ] **Portal día:** entra como cliente a `/portal/today` (con `DEV_DATE` apuntando a ese día) → se ven los bloques en el orden guardado.
- [ ] **Cardio Zona 2:** en un día con bloque `cardio_zone2`, ingresa edad 50 → muestra "Tu Cardio zona 2 se encuentra en el rango: 102 – 119".
- [ ] **Día de descanso editable:** crea un día `Descanso` con un bloque de texto, publícalo → en el portal ese día muestra el texto (no la card genérica) y el badge "Descanso".
- [ ] **Protocolo Cardiovascular:** un día tipo `cardio` muestra el badge "Protocolo Cardiovascular".
- [ ] **Clonar día:** menú de una celda con día → "Clonar a…" a una celda vacía → aparece copiada con sus bloques. Repetir a una celda ocupada → pide confirmación de sobrescritura.
- [ ] **Clonar semana:** "Clonar semana" de la semana 1 a la semana 2 → la semana 2 replica los días.
- [ ] **Eliminar día:** menú → "Eliminar" → confirma → la celda queda vacía.
- [ ] **Upload:** agrega un bloque PDF y uno de imagen, sube archivos → se ven en el portal.
- [ ] **Pilares admin:** en una serie de CuarentaMás, "Pilares del mes" → edita "Alimentación con intención" con bloques → publícalo.
- [ ] **Pilares portal:** como cliente CuarentaMás, `/portal/pilares` → se ve el pilar publicado del mes actual en acordeón.
- [ ] **Gate de pilares:** como cliente Strong & Fit, `/portal/pilares` no muestra pilares (sección vacía) y el ítem de nav no aparece.

- [ ] **Step final: invoke `superpowers:verification-before-completion`** antes de declarar la Fase 2 completa, y actualiza `handoff.md` marcando Sub E y F como completados.

---

## Notas de cierre

- Tras terminar, actualizar `handoff.md` sección 10: marcar Subsistema E y F ✓, y la Fase 2 como COMPLETADA.
- `DEV_DATE` sigue siendo solo para desarrollo (gitignored). Removerlo antes de producción.
- Fuera de alcance (anotado en el spec): editar logs pasados (Fase 3), histórico de pilares, clonar serie/mes entre variantes.
