# Fase 5 — Dashboard Financiero · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el panel `/admin/dashboard` con métricas financieras reales (MRR, ingresos por mes, distribución por programa, pagos recientes) y corregir el bug que impide registrar el primer pago de cada suscripción en `invoices`.

**Architecture:** Tres capas, siguiendo el patrón existente del admin: funciones puras de agregación (`lib/admin/finance-helpers.ts`, TDD), queries server-only (`lib/admin/finance-queries.ts`, RLS admin vía `createClient()`), y presentación (Server Component `app/admin/dashboard/page.tsx` + dos Client Components Recharts). Aparte: fix del webhook `subscription_create` + script de backfill.

**Tech Stack:** Next.js (App Router, Server Components), Supabase (`@/lib/supabase/server`), Recharts (ya instalado), Vitest, Stripe SDK.

**Spec:** `docs/superpowers/specs/2026-06-10-fase-5-financiero-design.md`

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/admin/finance-helpers.ts` (crear) | Funciones puras: MRR, agrupaciones por mes/programa, renovaciones, `formatMXN`. Sin DB. |
| `__tests__/finance-helpers.test.ts` (crear) | Unit tests de los helpers. |
| `lib/admin/finance-queries.ts` (crear) | Queries server-only (RLS admin) que devuelven filas crudas. |
| `lib/webhooks/stripe-handlers.ts` (modificar) | Fix: registrar invoice en `subscription_create`. |
| `__tests__/webhooks.test.ts` (modificar) | Test del fix de `handleInvoicePaid`. |
| `scripts/backfill-first-invoices.ts` (crear) | Backfill idempotente de pagos faltantes desde Stripe. |
| `components/admin/RevenueBarChart.tsx` (crear) | Client Component: barras de ingresos (12 meses). |
| `components/admin/ProgramRevenueDonut.tsx` (crear) | Client Component: donut de ingresos por programa. |
| `app/admin/dashboard/page.tsx` (reemplazar stub) | Server Component: ensambla queries → helpers → UI. |

**Tipos compartidos** (definidos en `finance-helpers.ts`, reusados por queries y página):

```ts
export interface FinanceSubRow {
  current_period_end: string | null; // ISO
  price_mxn: number;
  program_name: string;
}

export interface FinanceInvoiceRow {
  amount_paid: number;       // en pesos
  invoice_date: string;      // ISO
  program_name: string;
}

export interface RecentPaymentRow {
  invoice_date: string;      // ISO
  client_name: string;
  program_name: string;
  amount_paid: number;
  status: string;            // 'paid' | 'open' | 'void' | 'uncollectible'
}

export interface MonthRevenue { key: string; label: string; total: number }
export interface ProgramCount { program: string; count: number }
export interface ProgramRevenue { program: string; total: number }
```

---

### Task 1: `formatMXN` (helper de formato)

**Files:**
- Create: `lib/admin/finance-helpers.ts`
- Test: `__tests__/finance-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { formatMXN } from "@/lib/admin/finance-helpers";

describe("formatMXN", () => {
  it("formatea pesos sin decimales con separador de miles", () => {
    expect(formatMXN(0)).toBe("$0");
    expect(formatMXN(990)).toBe("$990");
    expect(formatMXN(12500)).toBe("$12,500");
  });
  it("redondea a entero", () => {
    expect(formatMXN(990.49)).toBe("$990");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/finance-helpers.test.ts`
Expected: FAIL — "formatMXN is not a function" / módulo no encontrado.

- [ ] **Step 3: Write minimal implementation**

En `lib/admin/finance-helpers.ts` agrega los tipos del bloque "Tipos compartidos" (arriba) y:

```ts
const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatMXN(n: number): string {
  // Intl usa "MX$"; normalizamos al símbolo "$" usado en el prototipo.
  return MXN.format(Math.round(n)).replace(/^MX\$/, "$");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/finance-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/finance-helpers.ts __tests__/finance-helpers.test.ts
git commit -m "feat(fase-5): formatMXN helper + tipos de finance-helpers"
```

---

### Task 2: `computeMRR`

**Files:**
- Modify: `lib/admin/finance-helpers.ts`
- Test: `__tests__/finance-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { computeMRR } from "@/lib/admin/finance-helpers";

describe("computeMRR", () => {
  it("suma price_mxn de las suscripciones activas", () => {
    expect(computeMRR([{ price_mxn: 990 }, { price_mxn: 1490 }])).toBe(2480);
  });
  it("devuelve 0 sin suscripciones", () => {
    expect(computeMRR([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t computeMRR`
Expected: FAIL — "computeMRR is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
export function computeMRR(subs: { price_mxn: number }[]): number {
  return subs.reduce((sum, s) => sum + s.price_mxn, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t computeMRR`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/finance-helpers.ts __tests__/finance-helpers.test.ts
git commit -m "feat(fase-5): computeMRR"
```

---

### Task 3: `groupRevenueByMonth`

**Files:**
- Modify: `lib/admin/finance-helpers.ts`
- Test: `__tests__/finance-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { groupRevenueByMonth } from "@/lib/admin/finance-helpers";

describe("groupRevenueByMonth", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("devuelve monthsBack meses terminando en el mes actual, rellenando con 0", () => {
    const result = groupRevenueByMonth([], 3, now);
    expect(result.map((r) => r.key)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(result.every((r) => r.total === 0)).toBe(true);
  });
  it("suma amount_paid por mes de invoice_date", () => {
    const invoices = [
      { amount_paid: 990, invoice_date: "2026-06-02T00:00:00Z", program_name: "X" },
      { amount_paid: 1490, invoice_date: "2026-06-20T00:00:00Z", program_name: "Y" },
      { amount_paid: 500, invoice_date: "2026-05-10T00:00:00Z", program_name: "X" },
    ];
    const result = groupRevenueByMonth(invoices, 3, now);
    expect(result.find((r) => r.key === "2026-06")!.total).toBe(2480);
    expect(result.find((r) => r.key === "2026-05")!.total).toBe(500);
    expect(result.find((r) => r.key === "2026-04")!.total).toBe(0);
  });
  it("ignora invoices fuera de la ventana", () => {
    const invoices = [{ amount_paid: 999, invoice_date: "2026-01-01T00:00:00Z", program_name: "X" }];
    const result = groupRevenueByMonth(invoices, 3, now);
    expect(result.reduce((s, r) => s + r.total, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t groupRevenueByMonth`
Expected: FAIL — "groupRevenueByMonth is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function groupRevenueByMonth(
  invoices: FinanceInvoiceRow[],
  monthsBack = 12,
  now: Date = new Date()
): MonthRevenue[] {
  const buckets: MonthRevenue[] = [];
  const index = new Map<string, MonthRevenue>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    const label = d.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }).replace(".", "");
    const bucket = { key, label, total: 0 };
    buckets.push(bucket);
    index.set(key, bucket);
  }
  for (const inv of invoices) {
    const bucket = index.get(monthKey(new Date(inv.invoice_date)));
    if (bucket) bucket.total += inv.amount_paid;
  }
  return buckets;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t groupRevenueByMonth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/finance-helpers.ts __tests__/finance-helpers.test.ts
git commit -m "feat(fase-5): groupRevenueByMonth (ventana fija, rellena con 0)"
```

---

### Task 4: `groupClientsByProgram`

**Files:**
- Modify: `lib/admin/finance-helpers.ts`
- Test: `__tests__/finance-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { groupClientsByProgram } from "@/lib/admin/finance-helpers";

describe("groupClientsByProgram", () => {
  it("cuenta suscripciones por programa, orden descendente", () => {
    const subs = [
      { program_name: "CuarentaMás" },
      { program_name: "CuarentaMás" },
      { program_name: "Strong & Fit" },
    ];
    expect(groupClientsByProgram(subs)).toEqual([
      { program: "CuarentaMás", count: 2 },
      { program: "Strong & Fit", count: 1 },
    ]);
  });
  it("devuelve [] sin suscripciones", () => {
    expect(groupClientsByProgram([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t groupClientsByProgram`
Expected: FAIL — "groupClientsByProgram is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
export function groupClientsByProgram(subs: { program_name: string }[]): ProgramCount[] {
  const counts = new Map<string, number>();
  for (const s of subs) counts.set(s.program_name, (counts.get(s.program_name) ?? 0) + 1);
  return [...counts.entries()]
    .map(([program, count]) => ({ program, count }))
    .sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t groupClientsByProgram`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/finance-helpers.ts __tests__/finance-helpers.test.ts
git commit -m "feat(fase-5): groupClientsByProgram"
```

---

### Task 5: `groupRevenueByProgram`

**Files:**
- Modify: `lib/admin/finance-helpers.ts`
- Test: `__tests__/finance-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { groupRevenueByProgram } from "@/lib/admin/finance-helpers";

describe("groupRevenueByProgram", () => {
  it("suma amount_paid por programa, orden descendente", () => {
    const invoices = [
      { amount_paid: 990, invoice_date: "2026-06-01T00:00:00Z", program_name: "CuarentaMás" },
      { amount_paid: 990, invoice_date: "2026-06-01T00:00:00Z", program_name: "CuarentaMás" },
      { amount_paid: 1490, invoice_date: "2026-06-01T00:00:00Z", program_name: "Strong & Fit" },
    ];
    expect(groupRevenueByProgram(invoices)).toEqual([
      { program: "CuarentaMás", total: 1980 },
      { program: "Strong & Fit", total: 1490 },
    ]);
  });
  it("devuelve [] sin invoices", () => {
    expect(groupRevenueByProgram([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t groupRevenueByProgram`
Expected: FAIL — "groupRevenueByProgram is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
export function groupRevenueByProgram(invoices: FinanceInvoiceRow[]): ProgramRevenue[] {
  const totals = new Map<string, number>();
  for (const inv of invoices) totals.set(inv.program_name, (totals.get(inv.program_name) ?? 0) + inv.amount_paid);
  return [...totals.entries()]
    .map(([program, total]) => ({ program, total }))
    .sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t groupRevenueByProgram`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/finance-helpers.ts __tests__/finance-helpers.test.ts
git commit -m "feat(fase-5): groupRevenueByProgram"
```

---

### Task 6: `computeRenewalsThisMonth`

**Files:**
- Modify: `lib/admin/finance-helpers.ts`
- Test: `__tests__/finance-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { computeRenewalsThisMonth } from "@/lib/admin/finance-helpers";

describe("computeRenewalsThisMonth", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("cuenta subs que vencen en <=30 días y suma su price_mxn", () => {
    const subs = [
      { current_period_end: "2026-06-20T00:00:00Z", price_mxn: 990 },  // dentro
      { current_period_end: "2026-07-10T00:00:00Z", price_mxn: 1490 }, // dentro (<=30d)
      { current_period_end: "2026-08-01T00:00:00Z", price_mxn: 500 },  // fuera (>30d)
    ];
    expect(computeRenewalsThisMonth(subs, now)).toEqual({ count: 2, amount: 2480 });
  });
  it("ignora vencimientos pasados y nulos", () => {
    const subs = [
      { current_period_end: "2026-06-01T00:00:00Z", price_mxn: 990 }, // pasado
      { current_period_end: null, price_mxn: 1490 },                  // nulo
    ];
    expect(computeRenewalsThisMonth(subs, now)).toEqual({ count: 0, amount: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t computeRenewalsThisMonth`
Expected: FAIL — "computeRenewalsThisMonth is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
export function computeRenewalsThisMonth(
  subs: { current_period_end: string | null; price_mxn: number }[],
  now: Date = new Date()
): { count: number; amount: number } {
  const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let count = 0;
  let amount = 0;
  for (const s of subs) {
    if (!s.current_period_end) continue;
    const end = new Date(s.current_period_end);
    if (end >= now && end <= horizon) {
      count += 1;
      amount += s.price_mxn;
    }
  }
  return { count, amount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/finance-helpers.test.ts -t computeRenewalsThisMonth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/finance-helpers.ts __tests__/finance-helpers.test.ts
git commit -m "feat(fase-5): computeRenewalsThisMonth (ventana 30 días)"
```

---

### Task 7: Fix del bug del primer invoice (`subscription_create`)

**Files:**
- Modify: `lib/webhooks/stripe-handlers.ts:118-123` (`handleInvoicePaid`, rama `subscription_create`)
- Test: `__tests__/webhooks.test.ts`

**Contexto:** hoy la rama `subscription_create` llama `recordInvoice(invoice)` sin `subscriptionDbId`, y `recordInvoice` hace `if (!subscriptionDbId) return;` → no inserta. El fix busca la suscripción por `stripe_subscription_id` y pasa su `id`.

- [ ] **Step 1: Write the failing test**

En `__tests__/webhooks.test.ts`, agrega `handleInvoicePaid` al import existente desde `@/lib/webhooks/stripe-handlers` y agrega este bloque:

```ts
describe("handleInvoicePaid - subscription_create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReturnValue({ error: null });
    selectEqSingleMock.mockReturnValue({ data: { id: "db-sub-1" }, error: null });
  });

  it("registra el primer invoice con el subscription_id de la BD", async () => {
    const invoice = {
      id: "in_first_123",
      billing_reason: "subscription_create",
      amount_paid: 99000,
      currency: "mxn",
      status: "paid",
      created: 1749340800,
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_123" },
      },
    } as unknown as Stripe.Invoice;

    await handleInvoicePaid(invoice);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.subscription_id).toBe("db-sub-1");
    expect(payload.stripe_invoice_id).toBe("in_first_123");
    expect(payload.amount_paid).toBe(990);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/webhooks.test.ts -t "subscription_create"`
Expected: FAIL — `insertMock` no fue llamado (0 veces) porque `recordInvoice` retorna temprano sin `subscriptionDbId`.

- [ ] **Step 3: Write minimal implementation**

Reemplaza la rama `subscription_create` en `handleInvoicePaid`:

```ts
  // First invoice (subscription_create): la suscripción ya existe (creada por
  // checkout.session.completed). Buscamos su id para registrar el primer pago.
  if (invoice.billing_reason === "subscription_create") {
    const subscriptionId = getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      console.error("[webhook] invoice.paid (create): no subscription id", invoice.id);
      return;
    }
    const supabase: AnyClient = createServiceClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .single();
    if (sub) await recordInvoice(invoice, sub.id);
    else console.error("[webhook] invoice.paid (create): subscription not found", subscriptionId);
    return;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/webhooks.test.ts`
Expected: PASS (incluyendo los tests previos del archivo).

- [ ] **Step 5: Commit**

```bash
git add lib/webhooks/stripe-handlers.ts __tests__/webhooks.test.ts
git commit -m "fix(fase-5): registrar el primer invoice en subscription_create"
```

---

### Task 8: Script de backfill de invoices faltantes

**Files:**
- Create: `scripts/backfill-first-invoices.ts`

**Contexto:** los primeros pagos previos al fix no están en `invoices`. Este script recorre las suscripciones de la BD, lista sus invoices pagados en Stripe e inserta los que falten. Idempotente vía `stripe_invoice_id unique`. Soporta `--dry-run`.

- [ ] **Step 1: Write the script**

```ts
/**
 * Backfill de invoices pagados faltantes desde Stripe.
 * Uso:  npx tsx --env-file=.env.local scripts/backfill-first-invoices.ts [--dry-run]
 * Idempotente: sólo inserta invoices cuyo stripe_invoice_id no exista aún.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createServiceClient();

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id");
  if (error) throw error;

  const { data: existing } = await supabase.from("invoices").select("stripe_invoice_id");
  const known = new Set((existing ?? []).map((r: { stripe_invoice_id: string }) => r.stripe_invoice_id));

  let inserted = 0;
  for (const sub of subs ?? []) {
    if (!sub.stripe_subscription_id) continue;
    const invoices = await stripe.invoices.list({ subscription: sub.stripe_subscription_id, limit: 100 });
    for (const inv of invoices.data) {
      if (inv.status !== "paid" || !inv.id || known.has(inv.id)) continue;
      const payload = {
        subscription_id: sub.id,
        stripe_invoice_id: inv.id,
        amount_paid: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        invoice_date: new Date(inv.created * 1000).toISOString().split("T")[0],
      };
      console.log(`${dryRun ? "[dry-run] " : ""}insert invoice ${inv.id} ($${payload.amount_paid}) sub ${sub.id}`);
      if (!dryRun) {
        const { error: insErr } = await supabase.from("invoices").insert(payload);
        if (insErr) console.error("  insert error:", insErr.message);
        else { inserted += 1; known.add(inv.id); }
      }
    }
  }
  console.log(`Listo. ${dryRun ? "(dry-run) " : ""}invoices insertados: ${inserted}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run para verificar qué insertaría**

Run: `npx tsx --env-file=.env.local scripts/backfill-first-invoices.ts --dry-run`
Expected: imprime las líneas `[dry-run] insert invoice ...` de los primeros pagos faltantes, sin escribir en la BD. (Si no hay datos de test, imprime "invoices insertados: 0".)

- [ ] **Step 3: Ejecutar el backfill real**

Run: `npx tsx --env-file=.env.local scripts/backfill-first-invoices.ts`
Expected: inserta los faltantes e imprime el conteo. Correrlo de nuevo debe insertar 0 (idempotente).

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-first-invoices.ts
git commit -m "feat(fase-5): script de backfill de invoices faltantes (idempotente)"
```

---

### Task 9: Queries server-only (`finance-queries.ts`)

**Files:**
- Create: `lib/admin/finance-queries.ts`

**Contexto:** mismo patrón que `lib/admin/queries.ts` — `server-only`, `createClient()` (RLS admin vía `is_admin()`), tipados con `as unknown as` (como el resto del archivo). Devuelven las filas crudas que consumen los helpers. No tienen unit tests (igual que `queries.ts`); se validan en la verificación E2E (Task 13).

- [ ] **Step 1: Write the implementation**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  FinanceSubRow,
  FinanceInvoiceRow,
  RecentPaymentRow,
} from "./finance-helpers";

export async function getActiveSubscriptions(): Promise<FinanceSubRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("current_period_end, program_variants(price_mxn, programs(name))")
    .eq("status", "active");

  type Raw = {
    current_period_end: string | null;
    program_variants: { price_mxn: number; programs: { name: string } | null } | null;
  };
  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.program_variants)
    .map((r) => ({
      current_period_end: r.current_period_end,
      price_mxn: r.program_variants!.price_mxn,
      program_name: r.program_variants!.programs?.name ?? "—",
    }));
}

export async function getPaidInvoices(monthsBack = 12): Promise<FinanceInvoiceRow[]> {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const { data } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, subscriptions(program_variants(programs(name)))")
    .eq("status", "paid")
    .gte("invoice_date", cutoff.toISOString());

  type Raw = {
    amount_paid: number;
    invoice_date: string;
    subscriptions: { program_variants: { programs: { name: string } | null } | null } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    amount_paid: r.amount_paid,
    invoice_date: r.invoice_date,
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
  }));
}

export async function getPastDueCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "past_due");
  return count ?? 0;
}

export async function getRecentPayments(limit = 10): Promise<RecentPaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, status, subscriptions(profiles(full_name), program_variants(programs(name)))")
    .order("invoice_date", { ascending: false })
    .limit(limit);

  type Raw = {
    amount_paid: number;
    invoice_date: string;
    status: string;
    subscriptions: {
      profiles: { full_name: string | null } | null;
      program_variants: { programs: { name: string } | null } | null;
    } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    invoice_date: r.invoice_date,
    client_name: r.subscriptions?.profiles?.full_name ?? "—",
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
    amount_paid: r.amount_paid,
    status: r.status,
  }));
}
```

- [ ] **Step 2: Verify it compiles (typecheck)**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados con `finance-queries.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/finance-queries.ts
git commit -m "feat(fase-5): queries server-only del dashboard financiero"
```

---

### Task 10: `RevenueBarChart` (Client Component)

**Files:**
- Create: `components/admin/RevenueBarChart.tsx`

**Contexto:** patrón de `components/portal/PerformanceChart.tsx` (Recharts, `"use client"`, `ResponsiveContainer`). Aquí barras en lugar de línea. Recibe los 12 meses ya agregados.

- [ ] **Step 1: Write the implementation**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { MonthRevenue } from "@/lib/admin/finance-helpers";

export function RevenueBarChart({ data }: { data: MonthRevenue[] }) {
  if (data.every((d) => d.total === 0)) {
    return (
      <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 13, color: "var(--gris-texto)" }}>
        Aún no hay ingresos registrados
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="#f0eae9" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--gris-suave)" }} tickLine={false} axisLine={false} width={48}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: unknown) => [`$${Number(v).toLocaleString("es-MX")}`, "Ingresos"]}
          contentStyle={{ borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }}
        />
        <Bar dataKey="total" fill="#9982f4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/admin/RevenueBarChart.tsx
git commit -m "feat(fase-5): RevenueBarChart (Recharts, 12 meses)"
```

---

### Task 11: `ProgramRevenueDonut` (Client Component)

**Files:**
- Create: `components/admin/ProgramRevenueDonut.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ProgramRevenue } from "@/lib/admin/finance-helpers";

const COLORS = ["#9982f4", "#e0aaba", "#7fc8a9", "#f0c674", "#8fb8de", "#c9a0dc"];

export function ProgramRevenueDonut({ data }: { data: ProgramRevenue[] }) {
  if (data.length === 0) {
    return (
      <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 13, color: "var(--gris-texto)" }}>
        Aún no hay ingresos por programa
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="program" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: unknown) => `$${Number(v).toLocaleString("es-MX")}`}
          contentStyle={{ borderRadius: 8, fontSize: 12, fontFamily: "var(--font-body)" }} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/admin/ProgramRevenueDonut.tsx
git commit -m "feat(fase-5): ProgramRevenueDonut (Recharts)"
```

---

### Task 12: Ensamblar la página del dashboard

**Files:**
- Replace: `app/admin/dashboard/page.tsx` (stub actual de 12 líneas)

**Contexto:** Server Component. Llama las 4 queries (en paralelo con `Promise.all`), aplica los helpers, renderiza KPIs + barras + distribución (barras horizontales inline + donut) + tabla de pagos recientes. Estilo inline/tokens como el resto del admin y el prototipo `admin-dashboard.jsx`.

- [ ] **Step 1: Write the implementation**

```tsx
import {
  getActiveSubscriptions,
  getPaidInvoices,
  getPastDueCount,
  getRecentPayments,
} from "@/lib/admin/finance-queries";
import {
  computeMRR,
  computeRenewalsThisMonth,
  groupClientsByProgram,
  groupRevenueByMonth,
  groupRevenueByProgram,
  formatMXN,
} from "@/lib/admin/finance-helpers";
import { RevenueBarChart } from "@/components/admin/RevenueBarChart";
import { ProgramRevenueDonut } from "@/components/admin/ProgramRevenueDonut";

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  paid: { text: "Pagado", bg: "rgba(76,175,125,.14)", color: "var(--exito-deep)" },
  open: { text: "Pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  void: { text: "Anulado", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  uncollectible: { text: "Fallido", bg: "var(--error-tint)", color: "var(--error)" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, danger, href }: { label: string; value: string; sub?: string; danger?: boolean; href?: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <div className="font-body" style={{ fontWeight: 500, fontSize: 12.5, marginBottom: 10, color: "var(--gris-texto)" }}>{label}</div>
      <span className="font-head" style={{ fontSize: 30, fontWeight: 600, color: danger ? "var(--error)" : "var(--negro)" }}>{value}</span>
      {sub && (
        <div className="font-body" style={{ marginTop: 8, fontSize: 12, color: danger ? "var(--error)" : "var(--gris-texto)" }}>
          {href ? <a href={href} style={{ color: "inherit", textDecoration: "none" }}>{sub}</a> : sub}
        </div>
      )}
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const [activeSubs, invoices, pastDue, recent] = await Promise.all([
    getActiveSubscriptions(),
    getPaidInvoices(12),
    getPastDueCount(),
    getRecentPayments(10),
  ]);

  const mrr = computeMRR(activeSubs);
  const renewals = computeRenewalsThisMonth(activeSubs, now);
  const byMonth = groupRevenueByMonth(invoices, 12, now);
  const clientsByProgram = groupClientsByProgram(activeSubs);
  const revenueByProgram = groupRevenueByProgram(invoices);
  const maxClients = Math.max(1, ...clientsByProgram.map((p) => p.count));
  const monthLabel = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1000 }}>
      <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
      <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 13, marginBottom: 20, textTransform: "capitalize" }}>{monthLabel}</p>

      {/* KPIs */}
      <div className="flex" style={{ gap: 16, marginBottom: 18, alignItems: "stretch" }}>
        <Kpi label="Ingreso mensual recurrente" value={formatMXN(mrr)} sub="MRR estimado de activas" />
        <Kpi label="Suscripciones activas" value={String(activeSubs.length)} />
        <Kpi label="Renuevan este mes" value={String(renewals.count)} sub={formatMXN(renewals.amount)} />
        <Kpi label="Requieren atención" value={String(pastDue)} danger sub="Ver clientes →" href="/admin/clients" />
      </div>

      {/* Ingresos por mes */}
      <Card style={{ marginBottom: 18 }}>
        <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ingresos por mes</h3>
        <RevenueBarChart data={byMonth} />
      </Card>

      {/* Distribución */}
      <div className="flex" style={{ gap: 16, marginBottom: 18, alignItems: "stretch" }}>
        <Card style={{ flex: 1 }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Clientes por programa</h3>
          <div className="flex flex-col" style={{ gap: 16 }}>
            {clientsByProgram.length === 0 && <p className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>Sin suscripciones activas</p>}
            {clientsByProgram.map((p) => (
              <div key={p.program}>
                <div className="flex" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="font-body" style={{ fontSize: 13, fontWeight: 600 }}>{p.program}</span>
                  <span className="font-body" style={{ fontSize: 13, fontWeight: 600 }}>{p.count}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--gris-claro)" }}>
                  <div style={{ height: 8, borderRadius: 4, width: `${(p.count / maxClients) * 100}%`, background: "#9982f4" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ flex: 1 }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Ingresos por programa</h3>
          <ProgramRevenueDonut data={revenueByProgram} />
        </Card>
      </div>

      {/* Pagos recientes */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, padding: "18px 22px 12px" }}>Pagos recientes</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--gris-claro)" }}>
              {["Fecha", "Clienta", "Programa", "Monto", "Estado"].map((h) => (
                <th key={h} className="font-body" style={{ textAlign: h === "Monto" ? "right" : "left", padding: "10px 22px", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr><td colSpan={5} className="font-body" style={{ padding: "20px 22px", fontSize: 13, color: "var(--gris-texto)" }}>Aún no hay pagos registrados</td></tr>
            )}
            {recent.map((p, i) => {
              const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.open;
              return (
                <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, color: "var(--gris-texto)" }}>
                    {new Date(p.invoice_date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, fontWeight: 600 }}>{p.client_name}</td>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, color: "var(--gris-texto)" }}>{p.program_name}</td>
                  <td className="font-body" style={{ padding: "13px 22px", fontSize: 13.5, fontWeight: 600, textAlign: "right" }}>{formatMXN(p.amount_paid)}</td>
                  <td style={{ padding: "13px 22px" }}>
                    <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.color }}>{s.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: todos los tests pasan (helpers + webhooks + suites previas).

- [ ] **Step 4: Commit**

```bash
git add app/admin/dashboard/page.tsx
git commit -m "feat(fase-5): página del dashboard financiero (KPIs + gráficas + pagos)"
```

---

### Task 13: Verificación E2E manual

**Files:** ninguno (verificación).

- [ ] **Step 1: Levantar la app y entrar como admin**

Run: `npm run dev` → abrir `http://localhost:3000/admin/dashboard` autenticado como admin.
Expected: render sin errores; se ven los 4 KPIs, la gráfica de barras, las dos cards de distribución y la tabla de pagos.

- [ ] **Step 2: Cuadrar MRR**

Comparar el MRR mostrado contra la suma manual: en Supabase, `select sum(pv.price_mxn) from subscriptions s join program_variants pv on pv.id=s.program_variant_id where s.status='active'`.
Expected: coincide con el card MRR.

- [ ] **Step 3: Cuadrar ingresos por mes**

Comparar la barra del mes actual contra `select sum(amount_paid) from invoices where status='paid' and date_trunc('month', invoice_date::timestamptz)=date_trunc('month', now())`.
Expected: coincide (incluye el primer pago tras el backfill).

- [ ] **Step 4: Verificar "requieren atención" y RLS**

- Forzar una sub a `past_due` (o usar una existente) → el card "Requieren atención" muestra el conteo correcto.
- Con un usuario NO admin, abrir `/admin/dashboard` → middleware redirige / no muestra datos; una query directa a `invoices` ajenas devuelve vacío por RLS.

- [ ] **Step 5: Verificación final con la skill**

Usar `superpowers:verification-before-completion` antes de declarar la fase completa: correr `npx vitest run` y `npx tsc --noEmit`, confirmar salida en verde, y revisar los checks 1–6 de la sección 7 del spec.

---

## Self-Review (notas del autor del plan)

- **Cobertura del spec:** §2 entregable visual → Tasks 10–12. §3 métricas → Tasks 2–6 (helpers) + 9 (queries). §4 arquitectura 3 capas → Tasks 1–6 / 9 / 10–12. §5 bug+backfill → Tasks 7–8. §6 testing → tests en cada task + Task 13. §7 verificación E2E → Task 13. Sin gaps.
- **Sin placeholders:** todo el código está completo y los comandos tienen salida esperada.
- **Consistencia de tipos:** `FinanceSubRow`/`FinanceInvoiceRow`/`RecentPaymentRow`/`MonthRevenue`/`ProgramCount`/`ProgramRevenue` se definen en Task 1 (finance-helpers) y se reusan idénticos en queries (Task 9), charts (Tasks 10–11) y página (Task 12). `computeMRR` recibe `{price_mxn}`, `computeRenewalsThisMonth` recibe `{current_period_end, price_mxn}` — ambos satisfechos por `FinanceSubRow`. `groupRevenueByMonth/ByProgram` reciben `FinanceInvoiceRow`.
- **Nota de datos:** `recordInvoice` guarda `invoice_date` como fecha (`.split("T")[0]`); el filtrado por `gte`/`order` en queries lo trata como timestamptz a medianoche — correcto para agrupar por mes.
