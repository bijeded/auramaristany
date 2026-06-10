# Página de Pagos (`/admin/payments`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear `/admin/payments` (listado completo de invoices con filtro por estado y paginación) y agregar el enlace "Ver todos →" en la card de Pagos recientes del dashboard.

**Architecture:** El server trae todos los invoices una vez (`getAllPayments`); un client component (`PaymentsTable`) filtra por estado y pagina en el navegador, igual que `/admin/clients`. Se extraen dos utilidades compartidas: `paginate` (de `clients-helpers`) y `STATUS_LABEL` (del dashboard).

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (RLS admin), Vitest, inline styles con CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-06-10-admin-payments-design.md`

---

## File Structure

**Crear:**
- `lib/admin/pagination.ts` — `paginate<T>` genérico (movido de `clients-helpers.ts`).
- `lib/admin/payment-status.ts` — `STATUS_LABEL` (movido del dashboard).
- `components/admin/PaymentsTable.tsx` — tabla de pagos (client component).
- `app/admin/payments/page.tsx` — página server.
- `__tests__/pagination.test.ts` — tests de `paginate` (movidos de `clients-helpers.test.ts`).

**Modificar:**
- `lib/admin/clients-helpers.ts` — quitar `paginate` (ahora en `pagination.ts`).
- `components/admin/ClientsTable.tsx` — importar `paginate` desde `pagination.ts`.
- `__tests__/clients-helpers.test.ts` — quitar el `describe("paginate", ...)`.
- `lib/admin/finance-helpers.ts` — nuevo tipo `PaymentRow` + `filterPaymentsByStatus`.
- `lib/admin/finance-queries.ts` — nueva query `getAllPayments`.
- `__tests__/finance-helpers.test.ts` — tests de `filterPaymentsByStatus`.
- `app/admin/dashboard/page.tsx` — usar `STATUS_LABEL` importado + enlace "Ver todos →".

---

### Task 1: Extraer `paginate` a un módulo compartido

**Files:**
- Create: `lib/admin/pagination.ts`
- Create: `__tests__/pagination.test.ts`
- Modify: `lib/admin/clients-helpers.ts` (quitar `paginate`)
- Modify: `components/admin/ClientsTable.tsx` (actualizar import)
- Modify: `__tests__/clients-helpers.test.ts` (quitar describe de paginate)

- [ ] **Step 1: Create the new module with `paginate`**

Create `lib/admin/pagination.ts`:

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

- [ ] **Step 2: Move the paginate tests to a new file**

Create `__tests__/pagination.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { paginate } from "@/lib/admin/pagination";

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

- [ ] **Step 3: Remove `paginate` from `clients-helpers.ts`**

In `lib/admin/clients-helpers.ts`, delete the entire `paginate` function (the `export function paginate<T>(...) { ... }` block near the end of the file). Leave the other helpers untouched.

- [ ] **Step 4: Remove the paginate describe block from `clients-helpers.test.ts`**

In `__tests__/clients-helpers.test.ts`, delete the line `import { paginate } from "@/lib/admin/clients-helpers";` and the entire `describe("paginate", () => { ... });` block that follows it (the last describe block in the file).

- [ ] **Step 5: Update `ClientsTable.tsx` import**

In `components/admin/ClientsTable.tsx`, the current import (line ~7) is:

```ts
import {
  filterClients, paginate, clientsToCSV, canDeleteClient,
  type ClientListRow, type StatusFilter,
} from "@/lib/admin/clients-helpers";
```

Change it to remove `paginate` from that import and add a separate import:

```ts
import {
  filterClients, clientsToCSV, canDeleteClient,
  type ClientListRow, type StatusFilter,
} from "@/lib/admin/clients-helpers";
import { paginate } from "@/lib/admin/pagination";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npm run test:run -- pagination clients-helpers` and `npx tsc --noEmit`
Expected: pagination tests pass (4), clients-helpers tests pass (now without the paginate block), no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/pagination.ts __tests__/pagination.test.ts lib/admin/clients-helpers.ts __tests__/clients-helpers.test.ts components/admin/ClientsTable.tsx
git commit -m "refactor: extraer paginate a lib/admin/pagination (reutilizable)"
```

---

### Task 2: Extraer `STATUS_LABEL` a un módulo compartido

**Files:**
- Create: `lib/admin/payment-status.ts`
- Modify: `app/admin/dashboard/page.tsx` (usar el import, quitar la const local)

- [ ] **Step 1: Create the shared module**

Create `lib/admin/payment-status.ts`:

```ts
// Etiqueta + colores por estado de invoice (Stripe: 'paid' | 'open' | 'void' | 'uncollectible').
export const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  paid: { text: "Pagado", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  open: { text: "Pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  void: { text: "Anulado", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  uncollectible: { text: "Fallido", bg: "var(--error-tint)", color: "var(--error)" },
};
```

- [ ] **Step 2: Update the dashboard to import it**

In `app/admin/dashboard/page.tsx`:
1. Delete the local `const STATUS_LABEL: Record<...> = { ... };` block (lines ~18-23).
2. Add this import near the other `@/lib/admin/...` imports at the top:

```ts
import { STATUS_LABEL } from "@/lib/admin/payment-status";
```

- [ ] **Step 3: Typecheck + build the dashboard**

Run: `npx tsc --noEmit`
Expected: no errors (the dashboard still references `STATUS_LABEL` the same way, now imported).

- [ ] **Step 4: Commit**

```bash
git add lib/admin/payment-status.ts app/admin/dashboard/page.tsx
git commit -m "refactor: extraer STATUS_LABEL de invoices a lib/admin/payment-status"
```

---

### Task 3: `PaymentRow` + `filterPaymentsByStatus` (helper puro, TDD)

**Files:**
- Modify: `lib/admin/finance-helpers.ts`
- Modify: `__tests__/finance-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `__tests__/finance-helpers.test.ts`:

```ts
import { filterPaymentsByStatus, type PaymentRow } from "@/lib/admin/finance-helpers";

const pmt = (status: string): PaymentRow => ({
  invoice_date: "2026-06-01T00:00:00+00:00",
  profile_id: "p1",
  client_name: "Ana",
  program_name: "CuarentaMás",
  variant_name: "Base",
  amount_paid: 999,
  status,
});

describe("filterPaymentsByStatus", () => {
  const rows = [pmt("paid"), pmt("open"), pmt("paid"), pmt("void")];
  it("'todos' devuelve todas las filas", () => {
    expect(filterPaymentsByStatus(rows, "todos")).toHaveLength(4);
  });
  it("filtra por estado exacto", () => {
    expect(filterPaymentsByStatus(rows, "paid")).toHaveLength(2);
    expect(filterPaymentsByStatus(rows, "void")).toHaveLength(1);
    expect(filterPaymentsByStatus(rows, "uncollectible")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- finance-helpers`
Expected: FAIL — `filterPaymentsByStatus` / `PaymentRow` not exported.

- [ ] **Step 3: Write the implementation**

Append to `lib/admin/finance-helpers.ts`:

```ts
export interface PaymentRow {
  invoice_date: string;          // ISO (timestamptz)
  profile_id: string | null;
  client_name: string;
  program_name: string;
  variant_name: string;
  amount_paid: number;           // en pesos
  status: string;                // 'paid' | 'open' | 'void' | 'uncollectible'
}

export type PaymentStatusFilter = "todos" | "paid" | "open" | "void" | "uncollectible";

export function filterPaymentsByStatus(
  rows: PaymentRow[],
  status: PaymentStatusFilter
): PaymentRow[] {
  if (status === "todos") return rows;
  return rows.filter((r) => r.status === status);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- finance-helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/finance-helpers.ts __tests__/finance-helpers.test.ts
git commit -m "feat: PaymentRow + filterPaymentsByStatus (TDD)"
```

---

### Task 4: `getAllPayments` (query server-only)

**Files:**
- Modify: `lib/admin/finance-queries.ts`

Sin test unitario (toca Supabase); se valida en build + smoke. Acceptance: el código compila y sigue el patrón de `getRecentPayments`.

- [ ] **Step 1: Write the implementation**

In `lib/admin/finance-queries.ts`, add the `PaymentRow` type to the existing import from `finance-helpers` at the top of the file. The current import is:

```ts
import type {
  FinanceSubRow,
  FinanceInvoiceRow,
  RecentPaymentRow,
} from "./finance-helpers";
```

Change it to:

```ts
import type {
  FinanceSubRow,
  FinanceInvoiceRow,
  RecentPaymentRow,
  PaymentRow,
} from "./finance-helpers";
```

Then append this function at the end of the file:

```ts
export async function getAllPayments(): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "amount_paid, invoice_date, status, subscriptions(profile_id, profiles(full_name), program_variants(name, programs(name)))"
    )
    .order("invoice_date", { ascending: false });

  type Raw = {
    amount_paid: number;
    invoice_date: string;
    status: string;
    subscriptions: {
      profile_id: string;
      profiles: { full_name: string | null } | null;
      program_variants: { name: string; programs: { name: string } | null } | null;
    } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    invoice_date: r.invoice_date,
    profile_id: r.subscriptions?.profile_id ?? null,
    client_name: r.subscriptions?.profiles?.full_name ?? "—",
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
    variant_name: r.subscriptions?.program_variants?.name ?? "—",
    amount_paid: r.amount_paid,
    status: r.status,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/finance-queries.ts
git commit -m "feat: getAllPayments (listado completo de invoices, RLS admin)"
```

---

### Task 5: Componente `PaymentsTable`

**Files:**
- Create: `components/admin/PaymentsTable.tsx`

- [ ] **Step 1: Write the component**

Create `components/admin/PaymentsTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMXN, filterPaymentsByStatus, type PaymentRow, type PaymentStatusFilter } from "@/lib/admin/finance-helpers";
import { paginate } from "@/lib/admin/pagination";
import { STATUS_LABEL } from "@/lib/admin/payment-status";

const STATUS_FILTERS: { key: PaymentStatusFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "paid", label: "Pagado" },
  { key: "open", label: "Pendiente" },
  { key: "void", label: "Anulado" },
  { key: "uncollectible", label: "Fallido" },
];

function paymentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const [status, setStatus] = useState<PaymentStatusFilter>("todos");
  const [page, setPage] = useState(1);

  const filtered = filterPaymentsByStatus(rows, status);
  const { items, totalPages, page: current } = paginate(filtered, page);

  function setFilter(s: PaymentStatusFilter) {
    setStatus(s);
    setPage(1);
  }

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 1040 }}>
      <Link href="/admin/dashboard" className="font-body" style={{ color: "var(--lavanda)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 14 }}>
        ← Dashboard
      </Link>

      <h1 className="font-head" style={{ fontSize: 28, fontWeight: 700, marginBottom: 20 }}>
        Pagos <span style={{ fontSize: 17, color: "var(--gris-texto)", fontWeight: 400 }}>({rows.length})</span>
      </h1>

      {/* Filtros por estado */}
      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 20 }}>
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} className={"pill " + (status === f.key ? "active" : "")} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>
            {rows.length === 0 ? "Aún no hay pagos registrados." : "No hay pagos con ese estado."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--gris-claro)" }}>
                {["Fecha", "Clienta", "Programa", "Monto", "Estado"].map((h) => (
                  <th key={h} className="font-body" style={{ textAlign: h === "Monto" ? "right" : "left", padding: "12px 20px", fontWeight: 600, fontSize: 12, color: "var(--gris-texto)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((p, i) => {
                  const s = STATUS_LABEL[p.status] ?? STATUS_LABEL.open;
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--gris-linea)" }}>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, color: "var(--gris-texto)" }}>{paymentDate(p.invoice_date)}</td>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, fontWeight: 600 }}>
                        {p.profile_id ? (
                          <Link href={`/admin/clients/${p.profile_id}`} style={{ color: "var(--lavanda-dark)", textDecoration: "none" }}>{p.client_name}</Link>
                        ) : (
                          p.client_name
                        )}
                      </td>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, color: "var(--gris-texto)" }}>{p.program_name} · {p.variant_name}</td>
                      <td className="font-body" style={{ padding: "13px 20px", fontSize: 13.5, fontWeight: 600, textAlign: "right" }}>{formatMXN(p.amount_paid)}</td>
                      <td style={{ padding: "13px 20px" }}>
                        <span className="font-body" style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.color }}>{s.text}</span>
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
git add components/admin/PaymentsTable.tsx
git commit -m "feat: PaymentsTable (filtro por estado + paginación + clienta→ficha)"
```

---

### Task 6: Página server `/admin/payments`

**Files:**
- Create: `app/admin/payments/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/admin/payments/page.tsx`:

```tsx
import { getAllPayments } from "@/lib/admin/finance-queries";
import { PaymentsTable } from "@/components/admin/PaymentsTable";

export default async function AdminPaymentsPage() {
  const payments = await getAllPayments();
  return <PaymentsTable rows={payments} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/payments/page.tsx"
git commit -m "feat: página server /admin/payments"
```

---

### Task 7: Enlace "Ver todos →" en el dashboard + verificación final

**Files:**
- Modify: `app/admin/dashboard/page.tsx`

- [ ] **Step 1: Add the Link import**

In `app/admin/dashboard/page.tsx`, add at the top (with the other imports):

```ts
import Link from "next/link";
```

- [ ] **Step 2: Replace the "Pagos recientes" header with a flex row containing the "Ver todos" link**

In `app/admin/dashboard/page.tsx`, the current card header is:

```tsx
        <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600, padding: "18px 22px 12px" }}>Pagos recientes</h3>
```

Replace it with:

```tsx
        <div className="flex items-center justify-between" style={{ padding: "18px 22px 12px" }}>
          <h3 className="font-head" style={{ fontSize: 16, fontWeight: 600 }}>Pagos recientes</h3>
          <Link href="/admin/payments" className="font-body" style={{ color: "var(--lavanda)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Ver todos →</Link>
        </div>
```

- [ ] **Step 3: Full verification**

Run: `npm run test:run`
Expected: all green (pagination + finance-helpers + clients-helpers + the rest).

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build limpio; ruta `/admin/payments` aparece en el output.

- [ ] **Step 4: Manual verification (dev server)**

Run `npm run dev` y como admin:
1. `/admin/dashboard` → la card "Pagos recientes" muestra "Ver todos →"; clic lleva a `/admin/payments`.
2. `/admin/payments`: tabla de pagos, filtro por estado (pills), paginación (si hay >10), "Mostrando A–B de N".
3. Clic en una clienta → su ficha `/admin/clients/[clientId]`.
4. "← Dashboard" regresa al dashboard.

- [ ] **Step 5: Commit**

```bash
git add app/admin/dashboard/page.tsx
git commit -m "feat: enlace 'Ver todos →' de pagos en el dashboard (cierra /admin/payments)"
```

---

## Notas de verificación contra el spec

- **Enlace "Ver todos" en dashboard** → Task 7.
- **`getAllPayments` con profile_id + variant_name** → Task 4.
- **`PaymentRow` + `filterPaymentsByStatus` (TDD)** → Task 3.
- **Extraer `paginate`** → Task 1; **extraer `STATUS_LABEL`** → Task 2.
- **Página + componente (← Dashboard, pills de estado, tabla clienta→ficha, paginación 10, estados vacíos)** → Tasks 5–6.
- **Edge cases (invoice sin clienta → "—" sin enlace; timestamptz vía `new Date(...)`; reset a página 1 al filtrar)** → Task 5.
```
