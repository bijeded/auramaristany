# Gestión de Clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el stub `/admin/clients` en lista filtrable (búsqueda, filtros, paginación 10, CSV, eliminar) + ficha individual con 6 tabs (Resumen, Onboarding, Progreso, Fotos, Pagos, Mensajes), cerrando los follow-ups de CSV export (Fase 4) y borrado admin de fotos (Fase 3).

**Architecture:** Funciones puras testeables en `lib/admin/clients-helpers.ts` (TDD) + queries server-only en `lib/admin/clients-queries.ts` (RLS `is_admin()`, patrón `finance-queries.ts`). Páginas server-component que resuelven datos y los pasan a client components para interacción. Borrado total vía migración con `ON DELETE CASCADE` + endpoint que limpia Storage y llama `auth.admin.deleteUser`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (RLS + Storage), Vitest, lucide-react, Recharts (no usado aquí), inline styles con CSS custom properties del brand.

**Spec:** `docs/superpowers/specs/2026-06-10-gestion-clientes-design.md`

---

## File Structure

**Crear:**
- `lib/admin/date-helpers.ts` — `monthKey`, `monthLabel`, `dayLabel` (extraídos de `PhotosTab`).
- `lib/admin/clients-helpers.ts` — tipos + funciones puras (`filterClients`, `pickPrimarySubscription`, `subscriptionProgressLabel`, `canDeleteClient`, `clientsToCSV`, `paginate`).
- `lib/admin/clients-queries.ts` — `getClientsList`, `getClientDetail` (+ tipos `ClientDetail`).
- `__tests__/clients-helpers.test.ts` — tests TDD de los helpers.
- `__tests__/date-helpers.test.ts` — tests de los helpers de fecha.
- `components/admin/ClientsTable.tsx` — client component de la lista.
- `components/admin/ClientDetailTabs.tsx` — client component de la ficha (tabs).
- `components/admin/ClientPhotosTab.tsx` — galería admin (filtro por mes + borrar).
- `app/admin/clients/[clientId]/page.tsx` — server component de la ficha.
- `app/api/admin/clients/[clientId]/route.ts` — DELETE clienta.
- `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts` — DELETE foto (admin).
- `supabase/migrations/007_cascade_on_profile_delete.sql` — `ON DELETE CASCADE`.

**Modificar:**
- `app/admin/clients/page.tsx` — de stub a server component real.
- `components/portal/PhotosTab.tsx` — importar `monthKey`/`monthLabel`/`dayLabel` desde `lib/admin/date-helpers.ts` en vez de definirlos localmente.

---

### Task 1: Extraer helpers de fecha a módulo compartido

**Files:**
- Create: `lib/admin/date-helpers.ts`
- Create: `__tests__/date-helpers.test.ts`
- Modify: `components/portal/PhotosTab.tsx` (quitar funciones locales, importar)

- [ ] **Step 1: Write the failing test**

Create `__tests__/date-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { monthKey, monthLabel, dayLabel } from "@/lib/admin/date-helpers";

describe("monthKey", () => {
  it("devuelve YYYY-MM de un ISO date", () => {
    expect(monthKey("2026-06-10")).toBe("2026-06");
  });
});

describe("monthLabel", () => {
  it("formatea la llave de mes capitalizada en es-MX", () => {
    expect(monthLabel("2026-06")).toBe("Junio de 2026");
  });
});

describe("dayLabel", () => {
  it("formatea un ISO date a día corto capitalizado", () => {
    expect(dayLabel("2026-06-10")).toBe("10 jun 2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- date-helpers`
Expected: FAIL — `Cannot find module '@/lib/admin/date-helpers'`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin/date-helpers.ts` (copiado tal cual de `components/portal/PhotosTab.tsx`):

```ts
export function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

export function monthLabel(key: string): string {
  const d = new Date(`${key}-01T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- date-helpers`
Expected: PASS (3 tests).

Nota: si `dayLabel` produce `"10 jun. 2026"` (con punto, según build ICU), ajusta el `expect` a ese valor exacto. No cambies la función — solo alinea el test con la salida real de `toLocaleDateString`.

- [ ] **Step 5: Update PhotosTab to import from the shared module**

In `components/portal/PhotosTab.tsx`, delete the local `monthKey`, `monthLabel`, and `dayLabel` function definitions (the three functions near the top of the file) and add this import below the existing imports:

```ts
import { monthKey, monthLabel, dayLabel } from "@/lib/admin/date-helpers";
```

- [ ] **Step 6: Run the full portal photo test + typecheck**

Run: `npm run test:run -- photo` and `npx tsc --noEmit`
Expected: PASS / no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/date-helpers.ts __tests__/date-helpers.test.ts components/portal/PhotosTab.tsx
git commit -m "refactor: extraer monthKey/monthLabel/dayLabel a lib/admin/date-helpers"
```

---

### Task 2: Tipos + `filterClients` (helper puro)

**Files:**
- Create: `lib/admin/clients-helpers.ts`
- Create: `__tests__/clients-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/clients-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterClients, type ClientListRow } from "@/lib/admin/clients-helpers";

const base: ClientListRow = {
  profile_id: "p1",
  full_name: "Ana López",
  email: "ana@example.com",
  phone: null,
  program_name: "CuarentaMás",
  variant_name: "Base",
  enrollment_date: "2026-01-01",
  current_period_end: "2026-07-01",
  price_mxn: 999,
  status: "active",
};

const rows: ClientListRow[] = [
  base,
  { ...base, profile_id: "p2", full_name: "Beatriz Ruiz", email: "bea@x.com", status: "past_due", program_name: "Strong & Fit" },
  { ...base, profile_id: "p3", full_name: "Carla Díaz", email: "carla@x.com", status: "canceled" },
];

describe("filterClients", () => {
  it("sin filtros devuelve todas las filas", () => {
    expect(filterClients(rows, { query: "", program: "Todas", status: null })).toHaveLength(3);
  });
  it("busca por nombre o correo, case-insensitive", () => {
    expect(filterClients(rows, { query: "bea", program: "Todas", status: null })).toHaveLength(1);
    expect(filterClients(rows, { query: "ANA@", program: "Todas", status: null })[0].profile_id).toBe("p1");
  });
  it("filtra por programa", () => {
    const r = filterClients(rows, { query: "", program: "Strong & Fit", status: null });
    expect(r).toHaveLength(1);
    expect(r[0].profile_id).toBe("p2");
  });
  it("filtra 'Activas' por status active", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Activas" });
    expect(r.map((x) => x.profile_id)).toEqual(["p1"]);
  });
  it("filtra 'Vencidas' por past_due o unpaid", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Vencidas" });
    expect(r.map((x) => x.profile_id)).toEqual(["p2"]);
  });
  it("filtra 'Con pago fallido' por past_due", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Con pago fallido" });
    expect(r.map((x) => x.profile_id)).toEqual(["p2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- clients-helpers`
Expected: FAIL — `Cannot find module '@/lib/admin/clients-helpers'`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin/clients-helpers.ts`:

```ts
export type SubStatus = "active" | "past_due" | "canceled" | "unpaid";

export type StatusFilter = "Activas" | "Vencidas" | "Con pago fallido" | null;

export interface ClientListRow {
  profile_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  program_name: string;
  variant_name: string;
  enrollment_date: string;       // ISO date
  current_period_end: string | null; // ISO
  price_mxn: number;
  status: SubStatus;
}

export function filterClients(
  rows: ClientListRow[],
  opts: { query: string; program: string; status: StatusFilter }
): ClientListRow[] {
  const q = opts.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !(`${r.full_name} ${r.email}`.toLowerCase().includes(q))) return false;
    if (opts.program !== "Todas" && r.program_name !== opts.program) return false;
    if (opts.status === "Activas" && r.status !== "active") return false;
    if (opts.status === "Vencidas" && r.status !== "past_due" && r.status !== "unpaid") return false;
    if (opts.status === "Con pago fallido" && r.status !== "past_due") return false;
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- clients-helpers`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/clients-helpers.ts __tests__/clients-helpers.test.ts
git commit -m "feat: filterClients + tipos de la lista de clientes (TDD)"
```

---

### Task 3: `pickPrimarySubscription` (helper puro)

**Files:**
- Modify: `lib/admin/clients-helpers.ts`
- Modify: `__tests__/clients-helpers.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/clients-helpers.test.ts`:

```ts
import { pickPrimarySubscription, type SubLike } from "@/lib/admin/clients-helpers";

describe("pickPrimarySubscription", () => {
  const mk = (o: Partial<SubLike>): SubLike => ({
    status: "active", current_period_end: null, enrollment_date: "2026-01-01", created_at: "2026-01-01T00:00:00Z", ...o,
  });
  it("devuelve null sin suscripciones", () => {
    expect(pickPrimarySubscription([])).toBeNull();
  });
  it("prefiere la activa con current_period_end más lejano", () => {
    const a = mk({ status: "active", current_period_end: "2026-07-01" });
    const b = mk({ status: "active", current_period_end: "2026-09-01" });
    expect(pickPrimarySubscription([a, b])).toBe(b);
  });
  it("si no hay activa, toma la más reciente por enrollment_date", () => {
    const a = mk({ status: "canceled", enrollment_date: "2025-01-01" });
    const b = mk({ status: "canceled", enrollment_date: "2026-01-01" });
    expect(pickPrimarySubscription([a, b])).toBe(b);
  });
  it("una activa gana a una cancelada más reciente", () => {
    const act = mk({ status: "active", current_period_end: "2026-07-01", enrollment_date: "2025-01-01" });
    const can = mk({ status: "canceled", enrollment_date: "2026-06-01" });
    expect(pickPrimarySubscription([can, act])).toBe(act);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- clients-helpers`
Expected: FAIL — `pickPrimarySubscription` / `SubLike` not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/admin/clients-helpers.ts`:

```ts
export interface SubLike {
  status: SubStatus;
  current_period_end: string | null;
  enrollment_date: string;
  created_at: string;
}

export function pickPrimarySubscription<T extends SubLike>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  const actives = subs.filter((s) => s.status === "active");
  if (actives.length > 0) {
    return actives.reduce((best, s) =>
      (s.current_period_end ?? "") > (best.current_period_end ?? "") ? s : best
    );
  }
  return subs.reduce((best, s) =>
    s.enrollment_date > best.enrollment_date ? s : best
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- clients-helpers`
Expected: PASS (all `clients-helpers` tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/clients-helpers.ts __tests__/clients-helpers.test.ts
git commit -m "feat: pickPrimarySubscription (una fila por clienta) (TDD)"
```

---

### Task 4: `subscriptionProgressLabel` (helper puro)

**Files:**
- Modify: `lib/admin/clients-helpers.ts`
- Modify: `__tests__/clients-helpers.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/clients-helpers.test.ts`:

```ts
import { subscriptionProgressLabel } from "@/lib/admin/clients-helpers";

describe("subscriptionProgressLabel", () => {
  it("programa de término fijo muestra 'Mes N de D'", () => {
    expect(subscriptionProgressLabel(
      { months_elapsed: 3 },
      { billing_model: "fixed_term_monthly", duration_months: 6 }
    )).toBe("Mes 3 de 6");
  });
  it("programa rolling muestra solo 'Mes N'", () => {
    expect(subscriptionProgressLabel(
      { months_elapsed: 5 },
      { billing_model: "rolling_monthly", duration_months: null }
    )).toBe("Mes 5");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- clients-helpers`
Expected: FAIL — `subscriptionProgressLabel` not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/admin/clients-helpers.ts`:

```ts
export function subscriptionProgressLabel(
  sub: { months_elapsed: number },
  program: { billing_model: string; duration_months: number | null }
): string {
  if (program.billing_model === "fixed_term_monthly" && program.duration_months) {
    return `Mes ${sub.months_elapsed} de ${program.duration_months}`;
  }
  return `Mes ${sub.months_elapsed}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- clients-helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/clients-helpers.ts __tests__/clients-helpers.test.ts
git commit -m "feat: subscriptionProgressLabel por billing model (TDD)"
```

---

### Task 5: `canDeleteClient` (helper puro)

**Files:**
- Modify: `lib/admin/clients-helpers.ts`
- Modify: `__tests__/clients-helpers.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/clients-helpers.test.ts`:

```ts
import { canDeleteClient } from "@/lib/admin/clients-helpers";

describe("canDeleteClient", () => {
  it("permite borrar si no hay suscripciones", () => {
    expect(canDeleteClient([])).toEqual({ ok: true });
  });
  it("permite borrar si todas están canceladas", () => {
    expect(canDeleteClient([{ status: "canceled" }, { status: "canceled" }])).toEqual({ ok: true });
  });
  it("bloquea si hay una activa", () => {
    const r = canDeleteClient([{ status: "canceled" }, { status: "active" }]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
  it("bloquea si hay past_due o unpaid", () => {
    expect(canDeleteClient([{ status: "past_due" }]).ok).toBe(false);
    expect(canDeleteClient([{ status: "unpaid" }]).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- clients-helpers`
Expected: FAIL — `canDeleteClient` not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/admin/clients-helpers.ts`:

```ts
export function canDeleteClient(
  subs: { status: SubStatus }[]
): { ok: boolean; reason?: string } {
  const live = subs.some((s) => s.status !== "canceled");
  if (live) {
    return { ok: false, reason: "Tiene una suscripción activa. Cancélala en Stripe antes de eliminar." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- clients-helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/clients-helpers.ts __tests__/clients-helpers.test.ts
git commit -m "feat: canDeleteClient (guard de borrado con sub activa) (TDD)"
```

---

### Task 6: `clientsToCSV` (helper puro)

**Files:**
- Modify: `lib/admin/clients-helpers.ts`
- Modify: `__tests__/clients-helpers.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/clients-helpers.test.ts`:

```ts
import { clientsToCSV } from "@/lib/admin/clients-helpers";

describe("clientsToCSV", () => {
  it("incluye encabezado y una fila por clienta", () => {
    const csv = clientsToCSV([base]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Nombre,Email,Programa,Variante,Estado,Inscripción");
    expect(lines[1]).toBe("Ana López,ana@example.com,CuarentaMás,Base,Activa,2026-01-01");
  });
  it("escapa comas y comillas envolviendo en comillas dobles", () => {
    const csv = clientsToCSV([{ ...base, full_name: 'Díaz, "La" Ana' }]);
    expect(csv.split("\n")[1].startsWith('"Díaz, ""La"" Ana",')).toBe(true);
  });
  it("traduce el status a etiqueta en español", () => {
    const csv = clientsToCSV([{ ...base, status: "past_due" }]);
    expect(csv.split("\n")[1]).toContain("Pago fallido");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- clients-helpers`
Expected: FAIL — `clientsToCSV` not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/admin/clients-helpers.ts`:

```ts
const STATUS_ES: Record<SubStatus, string> = {
  active: "Activa",
  past_due: "Pago fallido",
  unpaid: "Impaga",
  canceled: "Cancelada",
};

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function clientsToCSV(rows: ClientListRow[]): string {
  const header = "Nombre,Email,Programa,Variante,Estado,Inscripción";
  const lines = rows.map((r) =>
    [r.full_name, r.email, r.program_name, r.variant_name, STATUS_ES[r.status], r.enrollment_date]
      .map(csvCell)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- clients-helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/clients-helpers.ts __tests__/clients-helpers.test.ts
git commit -m "feat: clientsToCSV con escaping (TDD)"
```

---

### Task 7: `paginate` (helper puro)

**Files:**
- Modify: `lib/admin/clients-helpers.ts`
- Modify: `__tests__/clients-helpers.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `__tests__/clients-helpers.test.ts`:

```ts
import { paginate } from "@/lib/admin/clients-helpers";

describe("paginate", () => {
  const nums = Array.from({ length: 23 }, (_, i) => i + 1);
  it("devuelve la primera página de 10 por defecto", () => {
    const r = paginate(nums, 1);
    expect(r.items).toHaveLength(10);
    expect(r.items[0]).toBe(1);
    expect(r.totalPages).toBe(3);
  });
  it("devuelve la última página parcial", () => {
    const r = paginate(nums, 3);
    expect(r.items).toEqual([21, 22, 23]);
  });
  it("clampa páginas fuera de rango a la última", () => {
    expect(paginate(nums, 99).items).toEqual([21, 22, 23]);
  });
  it("lista vacía => totalPages 1, items vacío", () => {
    expect(paginate([], 1)).toEqual({ items: [], totalPages: 1, page: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- clients-helpers`
Expected: FAIL — `paginate` not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/admin/clients-helpers.ts`:

```ts
export function paginate<T>(
  rows: T[],
  page: number,
  pageSize = 10
): { items: T[]; totalPages: number; page: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const clamped = Math.min(Math.max(1, page), totalPages);
  const start = (clamped - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), totalPages, page: clamped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- clients-helpers`
Expected: PASS (todos los grupos de `clients-helpers`).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/clients-helpers.ts __tests__/clients-helpers.test.ts
git commit -m "feat: paginate (10 por página) (TDD)"
```

---

### Task 8: `getClientsList` (query server-only)

**Files:**
- Create: `lib/admin/clients-queries.ts`

No hay test unitario (toca Supabase). Se valida en la verificación manual (Task 17). La lógica testeable (`pickPrimarySubscription`) ya está cubierta.

- [ ] **Step 1: Write the implementation**

Create `lib/admin/clients-queries.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  pickPrimarySubscription,
  type ClientListRow,
  type SubStatus,
} from "./clients-helpers";

interface RawSubRow {
  profile_id: string;
  status: SubStatus;
  current_period_end: string | null;
  enrollment_date: string;
  created_at: string;
  profiles: { full_name: string; email: string; phone: string | null } | null;
  program_variants: { name: string; price_mxn: number; programs: { name: string } | null } | null;
}

export async function getClientsList(): Promise<ClientListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "profile_id, status, current_period_end, enrollment_date, created_at, profiles(full_name, email, phone), program_variants(name, price_mxn, programs(name))"
    );

  const rows = ((data ?? []) as unknown as RawSubRow[]).filter(
    (r) => r.profiles && r.program_variants
  );

  const byProfile = new Map<string, RawSubRow[]>();
  for (const r of rows) {
    const list = byProfile.get(r.profile_id) ?? [];
    list.push(r);
    byProfile.set(r.profile_id, list);
  }

  const result: ClientListRow[] = [];
  for (const subs of byProfile.values()) {
    const primary = pickPrimarySubscription(subs);
    if (!primary) continue;
    result.push({
      profile_id: primary.profile_id,
      full_name: primary.profiles!.full_name,
      email: primary.profiles!.email,
      phone: primary.profiles!.phone,
      program_name: primary.program_variants!.programs?.name ?? "—",
      variant_name: primary.program_variants!.name,
      enrollment_date: primary.enrollment_date,
      current_period_end: primary.current_period_end,
      price_mxn: primary.program_variants!.price_mxn,
      status: primary.status,
    });
  }

  result.sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  return result;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/clients-queries.ts
git commit -m "feat: getClientsList (una fila por clienta, RLS admin)"
```

---

### Task 9: `getClientDetail` (query server-only)

**Files:**
- Modify: `lib/admin/clients-queries.ts`

- [ ] **Step 1: Write the implementation**

Append to `lib/admin/clients-queries.ts`:

```ts
import { createServiceClient } from "@/lib/supabase/service";
import { canDeleteClient } from "./clients-helpers";
import { countCompleted } from "@/lib/content/history-helpers";

export interface ClientSubscription {
  id: string;
  program_name: string;
  variant_name: string;
  billing_model: string;
  duration_months: number | null;
  months_elapsed: number;
  status: SubStatus;
  enrollment_date: string;
  current_period_end: string | null;
  price_mxn: number;
}

export interface OnboardingAnswer { question: string; answer: string }
export interface ProgressEntry { date: string; title: string; focus: string | null; completed: boolean; doneCount: number }
export interface ClientPhoto { id: string; url: string; photoDate: string; caption: string | null }
export interface PaymentEntry { date: string; amount: number; status: string }
export interface ClientMessage { id: string; subject: string; createdAt: string; readAt: string | null }

export interface ClientDetail {
  profile: { id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null };
  subscriptions: ClientSubscription[];
  onboarding: OnboardingAnswer[];
  progress: ProgressEntry[];
  photos: ClientPhoto[];
  payments: PaymentEntry[];
  messages: ClientMessage[];
  canDelete: { ok: boolean; reason?: string };
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url")
    .eq("id", clientId)
    .maybeSingle();
  const profile = rawProfile as unknown as ClientDetail["profile"] | null;
  if (!profile) return null;

  // Suscripciones
  const { data: rawSubs } = await supabase
    .from("subscriptions")
    .select(
      "id, status, enrollment_date, current_period_end, months_elapsed, program_variants(name, price_mxn, programs(name, billing_model, duration_months))"
    )
    .eq("profile_id", clientId)
    .order("enrollment_date", { ascending: false });

  type RawSub = {
    id: string; status: SubStatus; enrollment_date: string; current_period_end: string | null; months_elapsed: number;
    program_variants: { name: string; price_mxn: number; programs: { name: string; billing_model: string; duration_months: number | null } | null } | null;
  };
  const subscriptions: ClientSubscription[] = ((rawSubs ?? []) as unknown as RawSub[])
    .filter((s) => s.program_variants)
    .map((s) => ({
      id: s.id,
      program_name: s.program_variants!.programs?.name ?? "—",
      variant_name: s.program_variants!.name,
      billing_model: s.program_variants!.programs?.billing_model ?? "rolling_monthly",
      duration_months: s.program_variants!.programs?.duration_months ?? null,
      months_elapsed: s.months_elapsed,
      status: s.status,
      enrollment_date: s.enrollment_date,
      current_period_end: s.current_period_end,
      price_mxn: s.program_variants!.price_mxn,
    }));

  // Onboarding
  const { data: rawQuestions } = await supabase
    .from("onboarding_questions")
    .select("id, question_text, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  const { data: rawResp } = await supabase
    .from("onboarding_responses")
    .select("responses")
    .eq("profile_id", clientId)
    .maybeSingle();

  type Q = { id: string; question_text: string };
  const responses = ((rawResp as unknown as { responses: Record<string, unknown> } | null)?.responses) ?? {};
  const onboarding: OnboardingAnswer[] = ((rawQuestions ?? []) as unknown as Q[]).map((q) => {
    const v = responses[q.id];
    const answer = Array.isArray(v) ? v.join(" · ") : v == null || v === "" ? "—" : String(v);
    return { question: q.question_text, answer };
  });

  // Progreso
  const { data: rawLogs } = await supabase
    .from("progress_logs")
    .select("log_date, completed, exercises_done, program_days(title, workout_focus)")
    .eq("profile_id", clientId)
    .order("log_date", { ascending: false });
  type RawLog = { log_date: string; completed: boolean; exercises_done: Record<string, { completed?: boolean }> | null; program_days: { title: string; workout_focus: string | null } | null };
  const progress: ProgressEntry[] = ((rawLogs ?? []) as unknown as RawLog[]).map((l) => ({
    date: l.log_date,
    title: l.program_days?.title ?? "Día",
    focus: l.program_days?.workout_focus ?? null,
    completed: l.completed,
    doneCount: countCompleted(l.exercises_done),
  }));

  // Fotos (rows vía RLS admin; signed URLs vía service client)
  const { data: rawPhotos } = await supabase
    .from("progress_photos")
    .select("id, storage_path, taken_at, caption")
    .eq("profile_id", clientId)
    .order("taken_at", { ascending: false });
  type RawPhoto = { id: string; storage_path: string; taken_at: string; caption: string | null };
  const service = createServiceClient();
  const photos: ClientPhoto[] = [];
  for (const p of (rawPhotos ?? []) as unknown as RawPhoto[]) {
    const { data: signed } = await service.storage.from("progress").createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) {
      photos.push({ id: p.id, url: signed.signedUrl, photoDate: p.taken_at, caption: p.caption });
    }
  }

  // Pagos (invoices de las suscripciones de la clienta)
  const { data: rawInvoices } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, status, subscriptions!inner(profile_id)")
    .eq("subscriptions.profile_id", clientId)
    .order("invoice_date", { ascending: false });
  type RawInv = { amount_paid: number; invoice_date: string; status: string };
  const payments: PaymentEntry[] = ((rawInvoices ?? []) as unknown as RawInv[]).map((i) => ({
    date: i.invoice_date,
    amount: i.amount_paid,
    status: i.status,
  }));

  // Mensajes
  const { data: rawMsgs } = await supabase
    .from("message_recipients")
    .select("read_at, messages(id, subject, created_at)")
    .eq("recipient_id", clientId);
  type RawMsg = { read_at: string | null; messages: { id: string; subject: string; created_at: string } | null };
  const messages: ClientMessage[] = ((rawMsgs ?? []) as unknown as RawMsg[])
    .filter((m) => m.messages)
    .map((m) => ({ id: m.messages!.id, subject: m.messages!.subject, createdAt: m.messages!.created_at, readAt: m.read_at }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    profile,
    subscriptions,
    onboarding,
    progress,
    photos,
    payments,
    messages,
    canDelete: canDeleteClient(subscriptions),
  };
}
```

- [ ] **Step 2: Verify `countCompleted` signature**

Run: `grep -n "export function countCompleted" lib/content/history-helpers.ts`
Expected: `export function countCompleted(done: ExercisesDone | null | undefined): number`. If the parameter type name differs, the call still works (we pass the jsonb object). No change needed.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/admin/clients-queries.ts
git commit -m "feat: getClientDetail (perfil, subs, onboarding, progreso, fotos, pagos, mensajes)"
```

---

### Task 10: Migración `ON DELETE CASCADE`

**Files:**
- Create: `supabase/migrations/007_cascade_on_profile_delete.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/007_cascade_on_profile_delete.sql`:

```sql
-- ============================================================
-- 007 — ON DELETE CASCADE para borrado total de una clienta.
-- Borrar el auth.user (ya cascadea a profiles) debe limpiar
-- todas las filas dependientes. La mayoría de las FKs a
-- profiles/subscriptions se crearon sin cascade en 001.
-- ============================================================

-- subscriptions -> profiles
alter table subscriptions drop constraint subscriptions_profile_id_fkey;
alter table subscriptions add constraint subscriptions_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;

-- progress_logs -> profiles, subscriptions
alter table progress_logs drop constraint progress_logs_profile_id_fkey;
alter table progress_logs add constraint progress_logs_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;
alter table progress_logs drop constraint progress_logs_subscription_id_fkey;
alter table progress_logs add constraint progress_logs_subscription_id_fkey
  foreign key (subscription_id) references subscriptions(id) on delete cascade;

-- body_metrics -> profiles
alter table body_metrics drop constraint body_metrics_profile_id_fkey;
alter table body_metrics add constraint body_metrics_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;

-- progress_photos -> profiles, body_metrics
alter table progress_photos drop constraint progress_photos_profile_id_fkey;
alter table progress_photos add constraint progress_photos_profile_id_fkey
  foreign key (profile_id) references profiles(id) on delete cascade;
alter table progress_photos drop constraint progress_photos_body_metrics_id_fkey;
alter table progress_photos add constraint progress_photos_body_metrics_id_fkey
  foreign key (body_metrics_id) references body_metrics(id) on delete cascade;

-- message_recipients -> profiles
alter table message_recipients drop constraint message_recipients_recipient_id_fkey;
alter table message_recipients add constraint message_recipients_recipient_id_fkey
  foreign key (recipient_id) references profiles(id) on delete cascade;

-- invoices -> subscriptions
alter table invoices drop constraint invoices_subscription_id_fkey;
alter table invoices add constraint invoices_subscription_id_fkey
  foreign key (subscription_id) references subscriptions(id) on delete cascade;

-- subscription_events -> subscriptions
alter table subscription_events drop constraint subscription_events_subscription_id_fkey;
alter table subscription_events add constraint subscription_events_subscription_id_fkey
  foreign key (subscription_id) references subscriptions(id) on delete cascade;
```

- [ ] **Step 2: Verify the real constraint names before applying**

Run this query in the Supabase SQL editor (or `psql`) to confirm each `*_fkey` name matches Postgres' auto-generated names:

```sql
select conname, conrelid::regclass as tbl
from pg_constraint
where contype = 'f'
  and conrelid::regclass::text in
    ('subscriptions','progress_logs','body_metrics','progress_photos','message_recipients','invoices','subscription_events')
order by tbl, conname;
```

If any name differs from what the migration assumes, edit the migration to use the real name. (Postgres default is `<table>_<column>_fkey`, which is what the migration uses.)

- [ ] **Step 3: Apply the migration in Supabase**

Apply `007_cascade_on_profile_delete.sql` via the Supabase SQL editor (project `bgvxaagfnzvzamtxqbkg`), same as migraciones 001–006.
Expected: `ALTER TABLE` success for each statement.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_cascade_on_profile_delete.sql
git commit -m "feat: migración 007 — ON DELETE CASCADE para borrado total de clienta"
```

---

### Task 11: Endpoint DELETE de foto (admin)

**Files:**
- Create: `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts`

- [ ] **Step 1: Write the implementation**

Create `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; photoId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = createServiceClient();
  const { data: rawPhoto } = await admin
    .from("progress_photos")
    .select("storage_path")
    .eq("id", params.photoId)
    .eq("profile_id", params.clientId)
    .maybeSingle();
  const photo = rawPhoto as unknown as { storage_path: string } | null;
  if (!photo) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await admin.storage.from("progress").remove([photo.storage_path]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("progress_photos").delete().eq("id", params.photoId);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/clients/[clientId]/photos/[photoId]/route.ts"
git commit -m "feat: endpoint admin para borrar foto de una clienta"
```

---

### Task 12: Endpoint DELETE de clienta (borrado total)

**Files:**
- Create: `app/api/admin/clients/[clientId]/route.ts`

- [ ] **Step 1: Write the implementation**

Create `app/api/admin/clients/[clientId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canDeleteClient, type SubStatus } from "@/lib/admin/clients-helpers";

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Guard: bloquear si hay suscripción no cancelada.
  const { data: rawSubs } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("profile_id", params.clientId);
  const subs = ((rawSubs ?? []) as unknown as { status: SubStatus }[]);
  const guard = canDeleteClient(subs);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 409 });
  }

  const admin = createServiceClient();

  // Borrar objetos de Storage de las fotos (no cascadean con la FK de BD).
  const { data: rawPhotos } = await admin
    .from("progress_photos")
    .select("storage_path")
    .eq("profile_id", params.clientId);
  const paths = ((rawPhotos ?? []) as unknown as { storage_path: string }[]).map((p) => p.storage_path);
  if (paths.length > 0) {
    await admin.storage.from("progress").remove(paths);
  }

  // Borrar el auth.user -> cascadea profiles y el resto (migración 007).
  const { error } = await admin.auth.admin.deleteUser(params.clientId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/admin/clients/[clientId]/route.ts"
git commit -m "feat: endpoint admin para eliminar clienta (guard sub activa + storage + auth)"
```

---

### Task 13: Componente de galería admin (`ClientPhotosTab`)

**Files:**
- Modify: `app/globals.css` (añadir utilidad `.pill`)
- Create: `components/admin/ClientPhotosTab.tsx`

> Nota: la clase `.pill` que usan el prototipo y los componentes de Tasks 13/14/16 **no existe** en `app/globals.css` (la app real usa inline styles). Se añade aquí porque esta es la primera tarea que la consume.

- [ ] **Step 1: Add the `.pill` utility to globals.css**

Append to the end of `app/globals.css`:

```css
/* Filtros tipo "pill" (admin) */
.pill {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid var(--gris-linea);
  background: #fff;
  color: var(--gris-texto);
  cursor: pointer;
}
.pill.active {
  background: var(--lavanda);
  border-color: var(--lavanda);
  color: #fff;
}
```

- [ ] **Step 2: Write the component**

Create `components/admin/ClientPhotosTab.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { monthKey, monthLabel, dayLabel } from "@/lib/admin/date-helpers";
import type { ClientPhoto } from "@/lib/admin/clients-queries";

export function ClientPhotosTab({ clientId, photos }: { clientId: string; photos: ClientPhoto[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("todas");
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const months = useMemo(
    () => Array.from(new Set(photos.map((p) => monthKey(p.photoDate)))).sort().reverse(),
    [photos]
  );
  const visible = filter === "todas" ? photos : photos.filter((p) => monthKey(p.photoDate) === filter);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta foto? Es permanente.")) return;
    setDeleting(id);
    await fetch(`/api/admin/clients/${clientId}/photos/${id}`, { method: "DELETE" });
    setViewIdx(null);
    setDeleting(null);
    router.refresh();
  }

  if (photos.length === 0) {
    return <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Esta clienta no ha subido fotos.</p>;
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
        <button className={"pill " + (filter === "todas" ? "active" : "")} onClick={() => setFilter("todas")}>Todas</button>
        {months.map((m) => (
          <button key={m} className={"pill " + (filter === m ? "active" : "")} onClick={() => setFilter(m)}>{monthLabel(m)}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {visible.map((p) => {
          const idx = photos.indexOf(p);
          return (
            <div key={p.id} style={{ borderRadius: 10, overflow: "hidden", position: "relative", aspectRatio: "1", cursor: "pointer" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? "Foto de progreso"} onClick={() => setViewIdx(idx)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(26,26,26,.6)", color: "#fff", fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 5, fontFamily: "var(--font-body)" }}>
                {dayLabel(p.photoDate)}
              </span>
              <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                title="Eliminar foto"
                style={{ position: "absolute", top: 6, right: 6, background: "rgba(26,26,26,.6)", border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: "#fff" }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {viewIdx !== null && photos[viewIdx] && (
        <div onClick={() => setViewIdx(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <button onClick={() => setViewIdx(null)} style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[viewIdx].url} alt={photos[viewIdx].caption ?? "Foto"} onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 10, objectFit: "contain" }} />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/admin/ClientPhotosTab.tsx
git commit -m "feat: ClientPhotosTab + utilidad .pill (galería admin con filtro por mes + borrar)"
```

---

### Task 14: Componente de la ficha (`ClientDetailTabs`)

**Files:**
- Create: `components/admin/ClientDetailTabs.tsx`

- [ ] **Step 1: Write the component**

Create `components/admin/ClientDetailTabs.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatMXN } from "@/lib/admin/finance-helpers";
import { subscriptionProgressLabel } from "@/lib/admin/clients-helpers";
import { dayLabel, monthLabel, monthKey } from "@/lib/admin/date-helpers";
import { normalizeWhatsappNumber, whatsappUrl } from "@/lib/admin/message-helpers";
import { ClientPhotosTab } from "./ClientPhotosTab";
import type { ClientDetail } from "@/lib/admin/clients-queries";

const TABS = [
  ["resumen", "Resumen"], ["onboarding", "Onboarding"], ["progreso", "Progreso"],
  ["fotos", "Fotos"], ["pagos", "Pagos"], ["mensajes", "Mensajes"],
] as const;

const PAY_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  paid: { label: "Pagado", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  open: { label: "Pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  void: { label: "Anulado", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  uncollectible: { label: "Fallido", bg: "var(--error-tint)", color: "var(--error)" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, padding: 20, ...style }}>{children}</div>;
}

export function ClientDetailTabs({ detail }: { detail: ClientDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("resumen");
  const [deleting, setDeleting] = useState(false);
  const phone = normalizeWhatsappNumber(detail.profile.phone);

  async function handleDelete() {
    if (!detail.canDelete.ok) return;
    if (!confirm(`¿Eliminar a ${detail.profile.full_name}? Se borrarán todos los datos, fotos y registros. Es irreversible.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/clients/${detail.profile.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/clients");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "No se pudo eliminar.");
      setDeleting(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px 40px", maxWidth: 920 }}>
      <Link href="/admin/clients" className="font-body" style={{ color: "var(--lavanda)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 14 }}>
        ← Clientes
      </Link>

      <div className="flex items-center gap-4" style={{ marginBottom: 22 }}>
        <div style={{ flex: 1 }}>
          <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>{detail.profile.full_name}</h1>
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>{detail.profile.email}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 22 }}>
        {TABS.map(([v, l]) => (
          <button key={v} className={"pill " + (tab === v ? "active" : "")} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {/* RESUMEN */}
      {tab === "resumen" && (
        <div className="flex gap-4" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
          <Card style={{ flex: 1, minWidth: 320 }}>
            {detail.subscriptions.length === 0 && (
              <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Sin suscripciones.</p>
            )}
            {detail.subscriptions.map((s, i) => (
              <div key={s.id} style={{ marginBottom: i < detail.subscriptions.length - 1 ? 18 : 0 }}>
                <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{s.program_name} · {s.variant_name}</h3>
                {[
                  ["Fecha de inicio", dayLabel(s.enrollment_date)],
                  ["Progreso", subscriptionProgressLabel({ months_elapsed: s.months_elapsed }, { billing_model: s.billing_model, duration_months: s.duration_months })],
                  ["Próximo cobro", s.current_period_end ? `${dayLabel(s.current_period_end)} · ${formatMXN(s.price_mxn)}` : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between" style={{ marginBottom: 10 }}>
                    <span className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>{k}</span>
                    <span className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </Card>
          <Card style={{ width: 240, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", gap: 12 }}>
            <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>Envía un mensaje directo a {detail.profile.full_name.split(" ")[0]}.</p>
            <Link href="/admin/messages" className="font-body" style={{ background: "var(--lavanda)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
              Enviar mensaje
            </Link>
          </Card>
        </div>
      )}

      {tab === "resumen" && (
        <div style={{ marginTop: 24 }}>
          <button onClick={handleDelete} disabled={!detail.canDelete.ok || deleting}
            title={detail.canDelete.ok ? "Eliminar clienta" : detail.canDelete.reason}
            className="font-body flex items-center gap-2"
            style={{ background: detail.canDelete.ok ? "var(--error-tint)" : "var(--gris-claro)", color: detail.canDelete.ok ? "var(--error)" : "var(--gris-suave)", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 13.5, cursor: detail.canDelete.ok ? "pointer" : "not-allowed" }}>
            <Trash2 size={16} /> Eliminar
          </button>
          {!detail.canDelete.ok && (
            <p className="font-body" style={{ color: "var(--gris-suave)", fontSize: 12, marginTop: 6 }}>{detail.canDelete.reason}</p>
          )}
        </div>
      )}

      {/* ONBOARDING */}
      {tab === "onboarding" && (
        <Card>
          {detail.onboarding.length === 0 && <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Sin respuestas de onboarding.</p>}
          {detail.onboarding.map((o, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)", marginBottom: 4 }}>{o.question}</div>
              <div className="font-body" style={{ fontWeight: 600, fontSize: 15 }}>{o.answer}</div>
            </div>
          ))}
        </Card>
      )}

      {/* PROGRESO */}
      {tab === "progreso" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {detail.progress.length === 0 ? (
            <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14, padding: 20 }}>Sin registros de entrenamiento.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>{["Fecha", "Día", "Estado", "Ejercicios"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "11px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {detail.progress.map((p, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{dayLabel(p.date)}</td>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>{p.title}{p.focus ? ` · ${p.focus}` : ""}</td>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{p.completed ? "Completo" : "Parcial"}</td>
                    <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{p.doneCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* FOTOS */}
      {tab === "fotos" && <ClientPhotosTab clientId={detail.profile.id} photos={detail.photos} />}

      {/* PAGOS */}
      {tab === "pagos" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {detail.payments.length === 0 ? (
            <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14, padding: 20 }}>Sin pagos registrados.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>{["Fecha", "Período", "Monto", "Estado"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "11px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {detail.payments.map((p, i) => {
                  const st = PAY_STATUS[p.status] ?? { label: p.status, bg: "var(--gris-claro)", color: "var(--gris-texto)" };
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5 }}>{dayLabel(p.date.slice(0, 10))}</td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>{monthLabel(monthKey(p.date.slice(0, 10)))}</td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600 }}>{formatMXN(p.amount)}</td>
                      <td style={{ padding: "12px 20px" }}>
                        <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* MENSAJES */}
      {tab === "mensajes" && (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600 }}>Mensajes enviados</h3>
            <div className="flex gap-2">
              {phone && (
                <a href={whatsappUrl(phone)} target="_blank" rel="noopener noreferrer"
                  className="font-body" style={{ background: "#25D366", color: "#fff", borderRadius: 10, padding: "8px 12px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                  Enviar WhatsApp
                </a>
              )}
              <Link href="/admin/messages" className="font-body" style={{ background: "var(--lavanda)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                + Nuevo mensaje
              </Link>
            </div>
          </div>
          {detail.messages.length === 0 ? (
            <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Sin mensajes enviados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {detail.messages.map((m) => (
                <Card key={m.id} style={{ padding: 14 }}>
                  <div className="font-head" style={{ fontWeight: 600, fontSize: 15 }}>{m.subject}</div>
                  <div className="font-body" style={{ color: "var(--gris-suave)", fontSize: 12, marginTop: 2 }}>
                    {dayLabel(m.createdAt.slice(0, 10))} · {m.readAt ? "Leído" : "No leído"}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Si `--error-tint`/`--exito` no existen como CSS vars, revisa `app/globals.css`; el dashboard ya las usa, así que deberían existir.)

- [ ] **Step 3: Commit**

```bash
git add components/admin/ClientDetailTabs.tsx
git commit -m "feat: ClientDetailTabs (6 tabs de la ficha + eliminar + WhatsApp)"
```

---

### Task 15: Página server de la ficha

**Files:**
- Create: `app/admin/clients/[clientId]/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/admin/clients/[clientId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/admin/clients-queries";
import { ClientDetailTabs } from "@/components/admin/ClientDetailTabs";

export default async function AdminClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  const detail = await getClientDetail(params.clientId);
  if (!detail) notFound();
  return <ClientDetailTabs detail={detail} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/clients/[clientId]/page.tsx"
git commit -m "feat: página server de la ficha individual de clienta"
```

---

### Task 16: Componente de la lista (`ClientsTable`)

**Files:**
- Create: `components/admin/ClientsTable.tsx`

- [ ] **Step 1: Write the component**

Create `components/admin/ClientsTable.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, Download } from "lucide-react";
import {
  filterClients, paginate, clientsToCSV, canDeleteClient,
  type ClientListRow, type StatusFilter,
} from "@/lib/admin/clients-helpers";
import { formatMXN } from "@/lib/admin/finance-helpers";
import { dayLabel } from "@/lib/admin/date-helpers";

const STATE_FILTERS: Exclude<StatusFilter, null>[] = ["Activas", "Vencidas", "Con pago fallido"];
const STATUS_BADGE: Record<ClientListRow["status"], { label: string; bg: string; color: string }> = {
  active: { label: "Activa", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  past_due: { label: "Pago fallido", bg: "var(--error-tint)", color: "var(--error)" },
  unpaid: { label: "Impaga", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  canceled: { label: "Cancelada", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
};

export function ClientsTable({ rows }: { rows: ClientListRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [prog, setProg] = useState("Todas");
  const [estado, setEstado] = useState<StatusFilter>(null);
  const [page, setPage] = useState(1);

  const programs = useMemo(() => ["Todas", ...Array.from(new Set(rows.map((r) => r.program_name))).sort()], [rows]);
  const activas = rows.filter((r) => r.status === "active").length;
  const filtered = filterClients(rows, { query: q, program: prog, status: estado });
  const { items, totalPages, page: current } = paginate(filtered, page);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  function exportCSV() {
    const csv = clientsToCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(row: ClientListRow, e: React.MouseEvent) {
    e.stopPropagation();
    const guard = canDeleteClient([{ status: row.status }]);
    if (!guard.ok) return;
    if (!confirm(`¿Eliminar a ${row.full_name}? Se borrarán todos los datos, fotos y registros. Es irreversible.`)) return;
    const res = await fetch(`/api/admin/clients/${row.profile_id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "No se pudo eliminar.");
    }
  }

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1040 }}>
      <div className="flex items-end justify-between" style={{ marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <h1 className="font-head" style={{ fontSize: 28, fontWeight: 700 }}>
          Clientes <span style={{ fontSize: 17, color: "var(--gris-texto)", fontWeight: 400 }}>({activas} activas)</span>
        </h1>
        <div className="flex gap-2 items-center">
          <div style={{ position: "relative", width: 260 }}>
            <span style={{ position: "absolute", left: 12, top: 11 }}><Search size={17} color="var(--gris-suave)" /></span>
            <input value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Buscar por nombre o correo..."
              className="font-body" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--gris-linea)", fontSize: 14 }} />
          </div>
          <button onClick={exportCSV} className="font-body flex items-center gap-2"
            style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 10, padding: "10px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros: programa | estado */}
      <div className="flex gap-2 flex-wrap items-center" style={{ marginBottom: 20 }}>
        {programs.map((f) => (
          <button key={f} className={"pill " + (prog === f ? "active" : "")} onClick={() => resetPage(setProg)(f)}>{f}</button>
        ))}
        <span style={{ width: 1, height: 22, background: "var(--gris-linea)", margin: "0 6px" }} aria-hidden />
        {STATE_FILTERS.map((f) => (
          <button key={f} className={"pill " + (estado === f ? "active" : "")} onClick={() => resetPage(setEstado)(estado === f ? null : f)}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14, marginBottom: 12 }}>No hay clientes con esos filtros.</p>
          <button onClick={() => { setQ(""); setProg("Todas"); setEstado(null); setPage(1); }}
            className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 10, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>
                {["Clienta", "Programa", "Inscripción", "Próximo cobro", "Estado", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "12px 20px", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((c) => {
                  const badge = STATUS_BADGE[c.status];
                  const canDel = canDeleteClient([{ status: c.status }]).ok;
                  return (
                    <tr key={c.profile_id} style={{ borderTop: "1px solid var(--gris-linea)", cursor: "pointer" }}
                      onClick={() => router.push(`/admin/clients/${c.profile_id}`)}>
                      <td style={{ padding: "12px 20px" }}>
                        <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>{c.full_name}</div>
                        <div className="font-body" style={{ color: "var(--gris-suave)", fontSize: 12 }}>{c.email}</div>
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "var(--lavanda-soft)", color: "var(--lavanda-dark)" }}>{c.program_name} · {c.variant_name}</span>
                      </td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>{dayLabel(c.enrollment_date)}</td>
                      <td style={{ padding: "12px 20px", fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--gris-texto)" }}>
                        {c.current_period_end ? `${dayLabel(c.current_period_end.slice(0, 10))} · ${formatMXN(c.price_mxn)}` : "—"}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        <button onClick={(e) => handleDelete(c, e)} disabled={!canDel}
                          title={canDel ? "Eliminar" : "Tiene una suscripción activa"}
                          style={{ background: "none", border: "none", cursor: canDel ? "pointer" : "not-allowed", color: canDel ? "var(--error)" : "var(--gris-linea)" }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
            <span className="font-body" style={{ fontSize: 12.5, color: "var(--gris-texto)" }}>
              Mostrando {(current - 1) * 10 + 1}–{Math.min(current * 10, filtered.length)} de {filtered.length}
            </span>
            <div className="flex gap-2">
              <button disabled={current <= 1} onClick={() => setPage(current - 1)}
                className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: current <= 1 ? "not-allowed" : "pointer", opacity: current <= 1 ? 0.5 : 1 }}>Anterior</button>
              <button disabled={current >= totalPages} onClick={() => setPage(current + 1)}
                className="font-body" style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: current >= totalPages ? "not-allowed" : "pointer", opacity: current >= totalPages ? 0.5 : 1 }}>Siguiente</button>
            </div>
          </div>
        </>
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
git add components/admin/ClientsTable.tsx
git commit -m "feat: ClientsTable (búsqueda, filtros con separador, paginación, CSV, eliminar)"
```

---

### Task 17: Página server de la lista + verificación final

**Files:**
- Modify: `app/admin/clients/page.tsx`

- [ ] **Step 1: Replace the stub with the real page**

Replace the entire contents of `app/admin/clients/page.tsx` with:

```tsx
import { getClientsList } from "@/lib/admin/clients-queries";
import { ClientsTable } from "@/components/admin/ClientsTable";

export default async function AdminClientsPage() {
  const rows = await getClientsList();
  return <ClientsTable rows={rows} />;
}
```

- [ ] **Step 2: Full test suite + typecheck + build**

Run: `npm run test:run`
Expected: all green (incluye `clients-helpers` y `date-helpers`).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 3: Manual verification (dev server con una clienta real)**

Run: `npm run dev` y verifica como admin:
1. `/admin/clients` lista las clientas (una fila por clienta), búsqueda y filtros funcionan; el separador `|` se ve entre programa y estado.
2. Paginación: con >10 clientas aparecen Anterior/Siguiente y "Mostrando A–B de N"; al filtrar vuelve a página 1.
3. "Exportar CSV" descarga `clientes.csv` respetando los filtros activos.
4. Click en una fila abre `/admin/clients/[clientId]`; las 6 tabs cargan (Resumen, Onboarding, Progreso, Fotos, Pagos, Mensajes).
5. En Fotos: filtro por mes, lightbox, y borrar una foto (confirmación → desaparece).
6. En Mensajes: botón WhatsApp aparece solo si la clienta tiene teléfono.
7. Botón "Eliminar" deshabilitado si la clienta tiene suscripción activa; con una clienta de prueba sin suscripción activa, el borrado redirige a la lista y la clienta desaparece.

- [ ] **Step 4: Commit**

```bash
git add app/admin/clients/page.tsx
git commit -m "feat: /admin/clients lista real (cierra Gestión de Clientes de Fase 6)"
```

---

## Notas de verificación contra el spec

- **Lista + filtros + separador + paginación 10 + CSV + eliminar** → Tasks 2, 6, 7, 16, 17.
- **Ficha 6 tabs** → Tasks 9, 13, 14, 15 (Resumen/Onboarding/Progreso/Fotos/Pagos/Mensajes).
- **Filtro de fotos por mes + borrar admin** → Tasks 1, 11, 13.
- **WhatsApp si hay teléfono** → Task 14.
- **Eliminar clienta (guard sub activa + cascade + storage)** → Tasks 5, 10, 12.
- **Una fila por clienta** → Tasks 3, 8.
- **Etiqueta de progreso por billing model** → Task 4.
- **TDD en helpers puros** → Tasks 1–7.
```
