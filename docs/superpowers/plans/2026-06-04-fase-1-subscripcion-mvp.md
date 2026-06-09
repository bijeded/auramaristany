# Fase 1 — Suscripción MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full subscriber acquisition flow: `/checkout/[variantSlug]` → Stripe payment → onboarding questionnaire → portal access, including all Stripe webhook handling and subscription gating in the middleware.

**Architecture:** Stripe Checkout (hosted page) handles all payment UI — no custom card forms needed. Webhooks are the single authoritative source for subscription state: the app never polls Stripe. Business logic extracted into pure functions for testability. Middleware updated to block portal access without an active subscription.

**Tech Stack:** `stripe` npm SDK, `@supabase/supabase-js` service role client (bypasses RLS for webhook writes), Next.js App Router API Routes, Vitest unit tests, Stripe CLI for local webhook forwarding.

---

## File Map

**New files:**
- `lib/stripe.ts` — Stripe SDK singleton (server only)
- `lib/supabase/service.ts` — Service role Supabase client (RLS bypass, webhooks only)
- `lib/subscriptions/prerequisites.ts` — Pure function: can client subscribe to a variant?
- `lib/webhooks/stripe-handlers.ts` — Pure business logic + DB writes for webhook events
- `app/(marketing)/layout.tsx` — Minimal pass-through layout for checkout route group
- `app/(marketing)/checkout/[variantSlug]/page.tsx` — Checkout landing (Server Component)
- `app/(marketing)/checkout/[variantSlug]/CheckoutButton.tsx` — "Pagar" button (Client Component)
- `app/api/subscriptions/create-checkout/route.ts` — POST: creates Stripe Checkout Session
- `app/api/webhooks/stripe/route.ts` — POST: verifies signature and dispatches webhook events
- `app/onboarding/layout.tsx` — Onboarding brand shell layout
- `app/onboarding/questionnaire/page.tsx` — Server Component: fetches questions from DB
- `app/onboarding/questionnaire/QuestionnaireForm.tsx` — Client Component: renders and submits form
- `app/portal/sin-suscripcion/page.tsx` — "Sin suscripción activa" page
- `supabase/migrations/002_seed_programs_variants.sql` — Seed: 3 programs + 10 variants + 3 onboarding questions
- `scripts/seed-stripe.ts` — Creates 10 Stripe Products/Prices in test mode, prints UPDATE SQL
- `__tests__/prerequisites.test.ts` — Unit tests for prerequisite check logic
- `__tests__/webhooks.test.ts` — Unit tests for webhook business logic

**Modified files:**
- `lib/middleware-utils.ts` — Add: no active subscription → `/portal/sin-suscripcion`
- `__tests__/middleware.test.ts` — Add 2 new test cases for subscription gate
- `.env.local` — Fill in Stripe keys

---

### Task 1: Stripe SDK + environment setup

**Files:**
- Create: `lib/stripe.ts`
- Create: `lib/supabase/service.ts`
- Modify: `.env.local`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/franciscovenegas/Desktop/Cowork/Aura
npm install stripe
npm install -D dotenv
```

Expected: packages added without errors.

- [ ] **Step 2: Get Stripe test keys (manual)**

1. Go to https://dashboard.stripe.com
2. Make sure **Test mode** is ON (toggle in top-right)
3. Click **Developers → API keys**
4. Copy **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`)

- [ ] **Step 3: Add Stripe keys to .env.local**

Open `/Users/franciscovenegas/Desktop/Cowork/Aura/.env.local` and fill in:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=
```

Leave `STRIPE_WEBHOOK_SECRET` empty for now — it's obtained when the Stripe CLI is running (Task 5).

- [ ] **Step 4: Create lib/stripe.ts**

```typescript
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});
```

- [ ] **Step 5: Create lib/supabase/service.ts**

This client uses the service role key and bypasses RLS. Only use in server-side API routes — never expose to the browser.

```typescript
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createServiceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add lib/stripe.ts lib/supabase/service.ts .env.local package.json package-lock.json
git commit -m "feat: add Stripe SDK singleton and service role Supabase client"
```

---

### Task 2: Seed data — programs, variants, Stripe products

**Files:**
- Create: `supabase/migrations/002_seed_programs_variants.sql`
- Create: `scripts/seed-stripe.ts`

Two-part task: (A) insert programs and variants into Supabase with placeholder price IDs, then (B) run a script that creates real Products/Prices in Stripe test mode and prints the SQL to update the IDs.

- [ ] **Step 1: Create supabase/migrations/002_seed_programs_variants.sql**

```sql
-- 002_seed_programs_variants.sql
-- Seed: 3 programs, 10 variants (placeholder stripe_price_id), prerequisites, onboarding questions
-- Run in Supabase Dashboard → SQL Editor → New query

-- Programs
insert into programs (id, slug, name, billing_model, duration_months) values
  ('00000000-0000-0000-0001-000000000001', 'cuarenta-mas',       'CuarentaMás',       'fixed_term_monthly', 6),
  ('00000000-0000-0000-0001-000000000002', 'cuarenta-mas-extra', 'CuarentaMás Extra', 'fixed_term_monthly', 6),
  ('00000000-0000-0000-0001-000000000003', 'strong-fit',         'Strong & Fit',      'rolling_monthly',    null);

-- Program variants (stripe_price_id placeholder — updated by seed-stripe.ts output)
insert into program_variants (id, program_id, slug, name, level, time_availability, stripe_price_id, price_mxn) values
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-principiante-poco', 'CuarentaMás Principiante Poco Tiempo',
   'principiante', 'poco_tiempo', 'price_placeholder_1', 999.00),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-principiante-suf', 'CuarentaMás Principiante Tiempo Suficiente',
   'principiante', 'tiempo_suficiente', 'price_placeholder_2', 999.00),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-intermedio-poco', 'CuarentaMás Intermedio Poco Tiempo',
   'intermedio', 'poco_tiempo', 'price_placeholder_3', 999.00),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-intermedio-suf', 'CuarentaMás Intermedio Tiempo Suficiente',
   'intermedio', 'tiempo_suficiente', 'price_placeholder_4', 999.00),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0001-000000000001',
   'cuarenta-mas-avanzado-suf', 'CuarentaMás Avanzado Tiempo Suficiente',
   'avanzado', 'tiempo_suficiente', 'price_placeholder_5', 999.00),
  ('00000000-0000-0000-0002-000000000006', '00000000-0000-0000-0001-000000000002',
   'cuarenta-mas-extra-intermedio', 'CuarentaMás Extra Intermedio',
   'intermedio', null, 'price_placeholder_6', 999.00),
  ('00000000-0000-0000-0002-000000000007', '00000000-0000-0000-0001-000000000002',
   'cuarenta-mas-extra-avanzado', 'CuarentaMás Extra Avanzado',
   'avanzado', null, 'price_placeholder_7', 999.00),
  ('00000000-0000-0000-0002-000000000008', '00000000-0000-0000-0001-000000000003',
   'strong-fit-principiante', 'Strong & Fit Principiante',
   'principiante', null, 'price_placeholder_8', 999.00),
  ('00000000-0000-0000-0002-000000000009', '00000000-0000-0000-0001-000000000003',
   'strong-fit-intermedio', 'Strong & Fit Intermedio',
   'intermedio', null, 'price_placeholder_9', 999.00),
  ('00000000-0000-0000-0002-000000000010', '00000000-0000-0000-0001-000000000003',
   'strong-fit-avanzado', 'Strong & Fit Avanzado',
   'avanzado', null, 'price_placeholder_10', 999.00);

-- Prerequisite: Extra Intermedio requires CuarentaMás completed (any level)
insert into program_variant_prerequisites
  (program_variant_id, prerequisite_group, required_program_slug, required_variant_levels, required_status)
values
  ('00000000-0000-0000-0002-000000000006', 1, 'cuarenta-mas', null, 'completed');

-- Prerequisite: Extra Avanzado requires (Extra Intermedio completed) OR (CuarentaMás intermedio/avanzado completed)
insert into program_variant_prerequisites
  (program_variant_id, prerequisite_group, required_program_slug, required_variant_levels, required_status)
values
  ('00000000-0000-0000-0002-000000000007', 1, 'cuarenta-mas-extra', array['intermedio'], 'completed'),
  ('00000000-0000-0000-0002-000000000007', 2, 'cuarenta-mas', array['intermedio','avanzado'], 'completed');

-- Seed 3 onboarding questions (Aura can edit these from admin panel later)
insert into onboarding_questions (sort_order, question_text, question_type, options, is_required) values
  (1, '¿Cuál es tu principal objetivo con el programa?', 'single_choice',
   '["Perder peso", "Ganar fuerza y músculo", "Mejorar mi salud general", "Aumentar mi energía"]'::jsonb, true),
  (2, '¿Tienes alguna lesión o condición médica que debamos considerar?', 'text', null, false),
  (3, '¿Cuántos días a la semana puedes entrenar?', 'single_choice',
   '["2-3 días", "4-5 días", "6-7 días"]'::jsonb, true);
```

- [ ] **Step 2: Run the SQL in Supabase (manual)**

Supabase Dashboard → SQL Editor → New query → paste the SQL → Run.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Create scripts/seed-stripe.ts**

```typescript
import Stripe from "stripe";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const variants = [
  { id: "00000000-0000-0000-0002-000000000001", slug: "cuarenta-mas-principiante-poco", name: "CuarentaMás Principiante Poco Tiempo" },
  { id: "00000000-0000-0000-0002-000000000002", slug: "cuarenta-mas-principiante-suf",  name: "CuarentaMás Principiante Tiempo Suficiente" },
  { id: "00000000-0000-0000-0002-000000000003", slug: "cuarenta-mas-intermedio-poco",   name: "CuarentaMás Intermedio Poco Tiempo" },
  { id: "00000000-0000-0000-0002-000000000004", slug: "cuarenta-mas-intermedio-suf",    name: "CuarentaMás Intermedio Tiempo Suficiente" },
  { id: "00000000-0000-0000-0002-000000000005", slug: "cuarenta-mas-avanzado-suf",      name: "CuarentaMás Avanzado Tiempo Suficiente" },
  { id: "00000000-0000-0000-0002-000000000006", slug: "cuarenta-mas-extra-intermedio",  name: "CuarentaMás Extra Intermedio" },
  { id: "00000000-0000-0000-0002-000000000007", slug: "cuarenta-mas-extra-avanzado",    name: "CuarentaMás Extra Avanzado" },
  { id: "00000000-0000-0000-0002-000000000008", slug: "strong-fit-principiante",        name: "Strong & Fit Principiante" },
  { id: "00000000-0000-0000-0002-000000000009", slug: "strong-fit-intermedio",          name: "Strong & Fit Intermedio" },
  { id: "00000000-0000-0000-0002-000000000010", slug: "strong-fit-avanzado",            name: "Strong & Fit Avanzado" },
];

async function main() {
  console.log("Creating Stripe Products and Prices (test mode)...\n");
  const sqlLines: string[] = [];

  for (const variant of variants) {
    const product = await stripe.products.create({
      name: variant.name,
      metadata: { variant_slug: variant.slug, variant_id: variant.id },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 99900,
      currency: "mxn",
      recurring: { interval: "month" },
      metadata: { variant_slug: variant.slug, variant_id: variant.id },
    });

    console.log(`✓ ${variant.slug}: ${price.id}`);
    sqlLines.push(
      `update program_variants set stripe_price_id = '${price.id}' where id = '${variant.id}';`
    );
  }

  console.log("\n-- Run this SQL in Supabase Dashboard → SQL Editor → New query:\n");
  sqlLines.forEach((line) => console.log(line));
  console.log("\n-- Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the Stripe seeding script**

```bash
npx tsx scripts/seed-stripe.ts
```

Expected output: 10 lines with `✓ <slug>: price_test_...`, then 10 UPDATE SQL statements.

- [ ] **Step 5: Run the UPDATE SQL in Supabase (manual)**

Copy all 10 `UPDATE` lines from the script output → Supabase Dashboard → SQL Editor → New query → Run.
Expected: `Success. No rows returned.`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/002_seed_programs_variants.sql scripts/seed-stripe.ts package.json package-lock.json
git commit -m "feat: seed programs, variants, onboarding questions; add Stripe products/prices script"
```

---

### Task 3: Prerequisite check logic (TDD)

**Files:**
- Create: `lib/subscriptions/prerequisites.ts`
- Create: `__tests__/prerequisites.test.ts`

The prerequisite logic is a pure function (no DB calls). The caller fetches data from DB and passes it in. Prerequisite groups use AND within a group, OR between groups.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/prerequisites.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { checkPrerequisites } from "@/lib/subscriptions/prerequisites";
import type { PrerequisiteRow, ClientSubscription } from "@/lib/subscriptions/prerequisites";

const noPrereqs: PrerequisiteRow[] = [];

const extraIntermedioPrereqs: PrerequisiteRow[] = [
  { prerequisite_group: 1, required_program_slug: "cuarenta-mas", required_variant_levels: null, required_status: "completed" },
];

const extraAvanzadoPrereqs: PrerequisiteRow[] = [
  { prerequisite_group: 1, required_program_slug: "cuarenta-mas-extra", required_variant_levels: ["intermedio"], required_status: "completed" },
  { prerequisite_group: 2, required_program_slug: "cuarenta-mas", required_variant_levels: ["intermedio", "avanzado"], required_status: "completed" },
];

describe("checkPrerequisites", () => {
  it("allows access when variant has no prerequisites", () => {
    expect(checkPrerequisites(noPrereqs, [])).toEqual({ allowed: true });
  });

  it("blocks access when prerequisites exist but client has no subscriptions", () => {
    const result = checkPrerequisites(extraIntermedioPrereqs, []);
    expect(result.allowed).toBe(false);
  });

  it("allows Extra Intermedio when CuarentaMás is completed (any level)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "principiante", status: "completed" },
    ];
    expect(checkPrerequisites(extraIntermedioPrereqs, subs)).toEqual({ allowed: true });
  });

  it("blocks Extra Intermedio when CuarentaMás is active but not completed", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "principiante", status: "active" },
    ];
    expect(checkPrerequisites(extraIntermedioPrereqs, subs)).toEqual({
      allowed: false,
      reason: "Prerequisite not met",
    });
  });

  it("allows Extra Avanzado when Extra Intermedio is completed (group 1)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas-extra", variant_level: "intermedio", status: "completed" },
    ];
    expect(checkPrerequisites(extraAvanzadoPrereqs, subs)).toEqual({ allowed: true });
  });

  it("allows Extra Avanzado when CuarentaMás Avanzado is completed (group 2)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "avanzado", status: "completed" },
    ];
    expect(checkPrerequisites(extraAvanzadoPrereqs, subs)).toEqual({ allowed: true });
  });

  it("blocks Extra Avanzado when only CuarentaMás Principiante completed (wrong level)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "principiante", status: "completed" },
    ];
    expect(checkPrerequisites(extraAvanzadoPrereqs, subs)).toEqual({
      allowed: false,
      reason: "Prerequisite not met",
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- __tests__/prerequisites.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/subscriptions/prerequisites'`

- [ ] **Step 3: Implement prerequisites.ts**

Create `lib/subscriptions/prerequisites.ts`:

```typescript
export interface PrerequisiteRow {
  prerequisite_group: number;
  required_program_slug: string;
  required_variant_levels: string[] | null;
  required_status: string;
}

export interface ClientSubscription {
  program_slug: string;
  variant_level: string | null;
  status: string;
}

export function checkPrerequisites(
  prerequisites: PrerequisiteRow[],
  clientSubscriptions: ClientSubscription[]
): { allowed: boolean; reason?: string } {
  if (prerequisites.length === 0) return { allowed: true };

  // Group prerequisite rows by prerequisite_group
  const groups = new Map<number, PrerequisiteRow[]>();
  for (const row of prerequisites) {
    const existing = groups.get(row.prerequisite_group) ?? [];
    existing.push(row);
    groups.set(row.prerequisite_group, existing);
  }

  // Groups are OR'd: if any single group is fully satisfied (AND), access is granted
  for (const groupRows of groups.values()) {
    const groupSatisfied = groupRows.every((req) =>
      clientSubscriptions.some((sub) => {
        if (sub.program_slug !== req.required_program_slug) return false;
        if (sub.status !== req.required_status) return false;
        if (req.required_variant_levels !== null && req.required_variant_levels.length > 0) {
          if (!req.required_variant_levels.includes(sub.variant_level ?? "")) return false;
        }
        return true;
      })
    );
    if (groupSatisfied) return { allowed: true };
  }

  return { allowed: false, reason: "Prerequisite not met" };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- __tests__/prerequisites.test.ts
```

Expected: 7/7 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/subscriptions/prerequisites.ts __tests__/prerequisites.test.ts
git commit -m "feat: add prerequisite check logic with unit tests (TDD)"
```

---

### Task 4: Checkout page + create-checkout API route

**Files:**
- Create: `app/(marketing)/layout.tsx`
- Create: `app/(marketing)/checkout/[variantSlug]/page.tsx`
- Create: `app/(marketing)/checkout/[variantSlug]/CheckoutButton.tsx`
- Create: `app/api/subscriptions/create-checkout/route.ts`

- [ ] **Step 1: Create app/(marketing)/layout.tsx**

```typescript
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create CheckoutButton.tsx (Client Component)**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CheckoutButton({ variantSlug }: { variantSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar el pago");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Error de red. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
      <Button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full font-head uppercase tracking-wider"
        style={{ background: "var(--lavanda)", color: "#fff" }}
      >
        {loading ? "Redirigiendo al pago..." : "Continuar al pago"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create checkout/[variantSlug]/page.tsx (Server Component)**

```typescript
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutButton } from "./CheckoutButton";

interface PageProps {
  params: { variantSlug: string };
}

export default async function CheckoutPage({ params }: PageProps) {
  const supabase = await createClient();

  const { data: variant } = await supabase
    .from("program_variants")
    .select("id, name, price_mxn, programs(name, billing_model, duration_months)")
    .eq("slug", params.variantSlug)
    .eq("is_active", true)
    .single();

  if (!variant) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const program = variant.programs as {
    name: string;
    billing_model: string;
    duration_months: number | null;
  } | null;

  const durationLabel =
    program?.billing_model === "fixed_term_monthly" && program.duration_months
      ? `${program.duration_months} meses`
      : "Mensual sin fecha de vencimiento";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--rosa-soft)" }}
    >
      <span
        className="font-head text-2xl font-semibold tracking-widest uppercase mb-8"
        style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
      >
        AURA
      </span>

      <div
        className="rounded-xl bg-white p-8 w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <p
          className="text-xs uppercase tracking-widest mb-1 font-head"
          style={{ color: "var(--gris-suave)" }}
        >
          {program?.name}
        </p>
        <h1 className="font-head text-xl mb-1">{variant.name}</h1>
        <p className="text-sm mb-4" style={{ color: "var(--gris-texto)" }}>
          {durationLabel}
        </p>
        <p className="font-head text-3xl mb-6">
          ${Number(variant.price_mxn).toLocaleString("es-MX")}{" "}
          <span className="text-base font-body" style={{ color: "var(--gris-texto)" }}>
            MXN/mes
          </span>
        </p>

        {user ? (
          <CheckoutButton variantSlug={params.variantSlug} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-center mb-2" style={{ color: "var(--gris-texto)" }}>
              Necesitas una cuenta para continuar
            </p>
            <a
              href={`/auth/register?next=/checkout/${params.variantSlug}`}
              className="block w-full text-center py-3 rounded-lg font-head uppercase tracking-wider text-sm text-white"
              style={{ background: "var(--lavanda)" }}
            >
              Crear cuenta
            </a>
            <a
              href={`/auth/login?next=/checkout/${params.variantSlug}`}
              className="block w-full text-center py-3 rounded-lg font-head uppercase tracking-wider text-sm"
              style={{ border: "1px solid var(--lavanda)", color: "var(--lavanda)" }}
            >
              Ya tengo cuenta
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create app/api/subscriptions/create-checkout/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import { checkPrerequisites } from "@/lib/subscriptions/prerequisites";
import type { PrerequisiteRow, ClientSubscription } from "@/lib/subscriptions/prerequisites";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { variantSlug } = body;

  if (!variantSlug || typeof variantSlug !== "string") {
    return NextResponse.json({ error: "variantSlug requerido" }, { status: 400 });
  }

  const service = createServiceClient();

  // Load variant
  const { data: variant } = await service
    .from("program_variants")
    .select("id, name, stripe_price_id")
    .eq("slug", variantSlug)
    .eq("is_active", true)
    .single();

  if (!variant) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  // Check prerequisites
  const { data: prereqRows } = await service
    .from("program_variant_prerequisites")
    .select("prerequisite_group, required_program_slug, required_variant_levels, required_status")
    .eq("program_variant_id", variant.id);

  if (prereqRows && prereqRows.length > 0) {
    const { data: clientSubs } = await service
      .from("subscriptions")
      .select("status, program_variants(level, programs(slug))")
      .eq("profile_id", user.id)
      .in("status", ["active", "completed"]);

    const mapped: ClientSubscription[] = (clientSubs ?? []).map((s: any) => ({
      program_slug: s.program_variants?.programs?.slug ?? "",
      variant_level: s.program_variants?.level ?? null,
      status: s.status,
    }));

    const check = checkPrerequisites(prereqRows as PrerequisiteRow[], mapped);
    if (!check.allowed) {
      return NextResponse.json(
        { error: "No cumples los prerequisitos para este programa" },
        { status: 403 }
      );
    }
  }

  // Get or create Stripe customer
  const { data: profile } = await service
    .from("profiles")
    .select("stripe_customer_id, full_name, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await service
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: variant.stripe_price_id, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/today`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${variantSlug}`,
    metadata: {
      supabase_user_id: user.id,
      variant_id: variant.id,
      variant_slug: variantSlug,
    },
    subscription_data: {
      metadata: { supabase_user_id: user.id, variant_id: variant.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Manual smoke test of checkout page**

With dev server running, go to: http://localhost:3000/checkout/cuarenta-mas-principiante-poco

Expected: page shows "AURA", program name, "CuarentaMás Principiante Poco Tiempo", "$999 MXN/mes", "6 meses", and login/register buttons (if not logged in) or "Continuar al pago" (if logged in).

- [ ] **Step 7: Commit**

```bash
git add "app/(marketing)/" app/api/subscriptions/
git commit -m "feat: add checkout landing page and create-checkout API route"
```

---

### Task 5: Stripe webhook handler (TDD)

**Files:**
- Create: `lib/webhooks/stripe-handlers.ts`
- Create: `app/api/webhooks/stripe/route.ts`
- Create: `__tests__/webhooks.test.ts`

Business logic extracted into pure functions for testability. The route only does signature verification and dispatches.

**Key design rule:** Stripe fires `invoice.paid` with `billing_reason="subscription_create"` for the first payment (same payment as checkout). That invoice must NOT increment `months_elapsed` since `checkout.session.completed` already sets it to 1. Only `billing_reason="subscription_cycle"` (renewals) increments the counter.

- [ ] **Step 1: Write failing tests**

Create `__tests__/webhooks.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeMonthsUpdate } from "@/lib/webhooks/stripe-handlers";

describe("computeMonthsUpdate", () => {
  it("increments months_elapsed by 1", () => {
    const result = computeMonthsUpdate(1, "rolling_monthly", null);
    expect(result.newMonthsElapsed).toBe(2);
    expect(result.shouldComplete).toBe(false);
  });

  it("sets shouldComplete when fixed_term program reaches duration", () => {
    const result = computeMonthsUpdate(5, "fixed_term_monthly", 6);
    expect(result.newMonthsElapsed).toBe(6);
    expect(result.shouldComplete).toBe(true);
  });

  it("does not set shouldComplete for rolling programs", () => {
    const result = computeMonthsUpdate(10, "rolling_monthly", null);
    expect(result.shouldComplete).toBe(false);
  });

  it("does not set shouldComplete before reaching duration", () => {
    const result = computeMonthsUpdate(4, "fixed_term_monthly", 6);
    expect(result.shouldComplete).toBe(false);
  });

  it("does not set shouldComplete when duration is null", () => {
    const result = computeMonthsUpdate(5, "fixed_term_monthly", null);
    expect(result.shouldComplete).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- __tests__/webhooks.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/webhooks/stripe-handlers'`

- [ ] **Step 3: Create lib/webhooks/stripe-handlers.ts**

```typescript
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";

// Pure function — testable without DB
export function computeMonthsUpdate(
  currentMonthsElapsed: number,
  billingModel: string,
  durationMonths: number | null
): { newMonthsElapsed: number; shouldComplete: boolean } {
  const newMonthsElapsed = currentMonthsElapsed + 1;
  const shouldComplete =
    billingModel === "fixed_term_monthly" &&
    durationMonths !== null &&
    newMonthsElapsed >= durationMonths;
  return { newMonthsElapsed, shouldComplete };
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();
  const { supabase_user_id, variant_id } = session.metadata ?? {};

  if (!supabase_user_id || !variant_id) {
    console.error("[webhook] checkout.session.completed: missing metadata", session.metadata);
    return;
  }

  const { error } = await supabase.from("subscriptions").insert({
    profile_id: supabase_user_id,
    program_variant_id: variant_id,
    stripe_subscription_id: session.subscription as string,
    stripe_customer_id: session.customer as string,
    status: "active",
    months_elapsed: 1,
    enrollment_date: new Date().toISOString().split("T")[0],
  });

  if (error) console.error("[webhook] subscription insert error:", error);
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Skip the first invoice (subscription_create) — months_elapsed already set to 1
  if (invoice.billing_reason === "subscription_create") {
    await recordInvoice(invoice);
    return;
  }

  const supabase = createServiceClient();

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("id, months_elapsed, program_variants(programs(billing_model, duration_months))")
    .eq("stripe_subscription_id", invoice.subscription as string)
    .single();

  if (error || !sub) {
    console.error("[webhook] invoice.paid: subscription not found", invoice.subscription);
    return;
  }

  await recordInvoice(invoice, sub.id);

  const program = (sub.program_variants as any)?.programs;
  const { newMonthsElapsed, shouldComplete } = computeMonthsUpdate(
    sub.months_elapsed,
    program?.billing_model ?? "rolling_monthly",
    program?.duration_months ?? null
  );

  const updatePayload: Record<string, unknown> = { months_elapsed: newMonthsElapsed };
  if (shouldComplete) updatePayload.completed_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", sub.id);

  if (updateError) console.error("[webhook] months_elapsed update error:", updateError);
}

async function recordInvoice(invoice: Stripe.Invoice, subscriptionDbId?: string) {
  if (!subscriptionDbId) return;
  const supabase = createServiceClient();
  await supabase.from("invoices").insert({
    subscription_id: subscriptionDbId,
    stripe_invoice_id: invoice.id,
    amount_paid: invoice.amount_paid / 100,
    currency: invoice.currency,
    status: invoice.status ?? "paid",
    invoice_date: new Date(invoice.created * 1000).toISOString().split("T")[0],
  });
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) console.error("[webhook] subscription.updated error:", error);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", subscription.id);

  if (error) console.error("[webhook] subscription.deleted error:", error);
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", invoice.subscription as string);

  if (error) console.error("[webhook] payment_failed update error:", error);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- __tests__/webhooks.test.ts
```

Expected: 5/5 passing.

- [ ] **Step 5: Create app/api/webhooks/stripe/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentFailed,
} from "@/lib/webhooks/stripe-handlers";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

Add the missing import at the top of route.ts (it needs the Stripe type):

```typescript
import type Stripe from "stripe";
```

- [ ] **Step 6: Set up Stripe CLI and get webhook secret (manual)**

Install Stripe CLI on Mac:
```bash
brew install stripe/stripe-cli/stripe
stripe login
```

In a separate terminal, start webhook forwarding:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI will print something like:
```
> Ready! Your webhook signing secret is whsec_abc123...
```

Copy that `whsec_...` value → add to `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

Restart the dev server so it picks up the new env var.

- [ ] **Step 7: Run all tests**

```bash
npm run test:run
```

Expected: all tests pass (prerequisites + webhooks + middleware).

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add lib/webhooks/ app/api/webhooks/ __tests__/webhooks.test.ts
git commit -m "feat: add Stripe webhook handler with TDD (checkout, invoice, subscription events)"
```

---

### Task 6: Onboarding questionnaire

**Files:**
- Create: `app/onboarding/layout.tsx`
- Create: `app/onboarding/questionnaire/page.tsx`
- Create: `app/onboarding/questionnaire/QuestionnaireForm.tsx`

- [ ] **Step 1: Create app/onboarding/layout.tsx**

```typescript
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--rosa-soft)" }}>
      <div className="flex items-center justify-center pt-8 pb-4">
        <span
          className="font-head text-xl tracking-widest uppercase"
          style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
        >
          AURA
        </span>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create QuestionnaireForm.tsx (Client Component)**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface Question {
  id: string;
  question_text: string;
  question_type: "text" | "number" | "single_choice" | "multi_choice";
  options: string[] | null;
  is_required: boolean;
}

export function QuestionnaireForm({
  questions,
  profileId,
}: {
  questions: Question[];
  profileId: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id: string, option: string) {
    const current = (answers[id] as string[]) ?? [];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    setAnswer(id, updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const q of questions) {
      if (q.is_required) {
        const ans = answers[q.id];
        const isEmpty = !ans || (Array.isArray(ans) && ans.length === 0) || ans === "";
        if (isEmpty) {
          setError(`Por favor responde: "${q.question_text}"`);
          return;
        }
      }
    }

    setLoading(true);
    const supabase = createClient();

    const { error: upsertError } = await supabase.from("onboarding_responses").upsert({
      profile_id: profileId,
      responses: answers,
      completed_at: new Date().toISOString(),
    });

    if (upsertError) {
      setError("Error al guardar tus respuestas. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", profileId);

    if (updateError) {
      setError("Error al actualizar tu perfil. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    router.push("/portal/today");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-8">
      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-2">
          <label
            className="font-head text-sm uppercase tracking-wide"
            style={{ color: "var(--negro)" }}
          >
            {q.question_text}
            {q.is_required && (
              <span style={{ color: "var(--lavanda)" }}> *</span>
            )}
          </label>

          {q.question_type === "text" && (
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
              style={{ borderColor: "var(--gris-linea)", minHeight: 80 }}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          )}

          {q.question_type === "number" && (
            <input
              type="number"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--gris-linea)" }}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
            />
          )}

          {(q.question_type === "single_choice" || q.question_type === "multi_choice") &&
            q.options &&
            q.options.map((option) => {
              const selected =
                q.question_type === "single_choice"
                  ? answers[q.id] === option
                  : ((answers[q.id] as string[]) ?? []).includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    q.question_type === "single_choice"
                      ? setAnswer(q.id, option)
                      : toggleMulti(q.id, option)
                  }
                  className="w-full text-left px-4 py-3 rounded-lg text-sm border transition-colors"
                  style={{
                    borderColor: selected ? "var(--lavanda)" : "var(--gris-linea)",
                    background: selected ? "var(--lavanda-soft)" : "white",
                    color: selected ? "var(--lavanda-dark)" : "var(--negro)",
                  }}
                >
                  {option}
                </button>
              );
            })}
        </div>
      ))}

      {error && (
        <p className="text-sm" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full font-head uppercase tracking-wider"
        style={{ background: "var(--lavanda)", color: "#fff" }}
      >
        {loading ? "Guardando..." : "Comenzar mi programa"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Create questionnaire/page.tsx (Server Component)**

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuestionnaireForm } from "./QuestionnaireForm";

export default async function QuestionnairePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/portal/today");

  const { data: questions } = await supabase
    .from("onboarding_questions")
    .select("id, question_text, question_type, options, is_required")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="flex flex-col items-center p-6">
      <div
        className="rounded-xl bg-white p-8 w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h1 className="font-head text-xl mb-1">Cuéntanos sobre ti</h1>
        <p className="text-sm mb-6" style={{ color: "var(--gris-texto)" }}>
          Aura personalizará tu experiencia con tus respuestas.
        </p>
        <QuestionnaireForm questions={questions ?? []} profileId={user.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Manual smoke test**

With dev server running, go to http://localhost:3000/onboarding/questionnaire (must be logged in, subscription active, onboarding_completed = false).

Expected: form with 3 questions seeded in Task 2.

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/
git commit -m "feat: add onboarding questionnaire (dynamic questions from DB)"
```

---

### Task 7: Middleware — enforce subscription requirement

**Files:**
- Create: `app/portal/sin-suscripcion/page.tsx`
- Modify: `lib/middleware-utils.ts`
- Modify: `__tests__/middleware.test.ts`

Currently a logged-in client with no active subscription can access `/portal`. This task adds the gate.

- [ ] **Step 1: Create app/portal/sin-suscripcion/page.tsx**

```typescript
export default function SinSuscripcionPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--rosa-soft)" }}
    >
      <span
        className="font-head text-2xl font-semibold tracking-widest uppercase mb-8"
        style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
      >
        AURA
      </span>
      <div
        className="rounded-xl bg-white p-8 text-center w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h1 className="font-head text-xl mb-2">Sin suscripción activa</h1>
        <p className="text-sm mb-6" style={{ color: "var(--gris-texto)" }}>
          Necesitas una suscripción activa para acceder al portal. Regresa al
          cuestionario de nivel en el sitio de Aura para elegir tu programa.
        </p>
        <a
          href="https://demo.studiosdmm.com.mx/aura/"
          className="block w-full text-center py-3 rounded-lg font-head uppercase tracking-wider text-sm text-white"
          style={{ background: "var(--lavanda)" }}
        >
          Ir al sitio de Aura
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add failing tests first**

Open `__tests__/middleware.test.ts` and add these two cases at the end of the existing `describe` block:

```typescript
it("redirects client with no subscription on /portal to /portal/sin-suscripcion", () => {
  expect(
    getRedirectPath({
      pathname: "/portal/today",
      hasSession: true,
      role: "client",
      onboardingCompleted: false,
      hasActiveSubscription: false,
    })
  ).toBe("/portal/sin-suscripcion");
});

it("redirects client with no subscription on /onboarding to /portal/sin-suscripcion", () => {
  expect(
    getRedirectPath({
      pathname: "/onboarding/questionnaire",
      hasSession: true,
      role: "client",
      onboardingCompleted: false,
      hasActiveSubscription: false,
    })
  ).toBe("/portal/sin-suscripcion");
});
```

- [ ] **Step 3: Run tests to confirm new cases fail**

```bash
npm run test:run -- __tests__/middleware.test.ts
```

Expected: 8 pass, 2 fail.

- [ ] **Step 4: Update lib/middleware-utils.ts**

```typescript
import type { UserRole } from "./supabase/types";

interface RedirectParams {
  pathname: string;
  hasSession: boolean;
  role: UserRole | null;
  onboardingCompleted: boolean;
  hasActiveSubscription: boolean;
}

export function getRedirectPath(params: RedirectParams): string | null {
  const { pathname, hasSession, role, onboardingCompleted, hasActiveSubscription } = params;

  const isProtectedRoute =
    pathname.startsWith("/portal") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/onboarding");

  if (!hasSession && isProtectedRoute) {
    return "/auth/login";
  }

  if (!hasSession) {
    return null;
  }

  if (role === "admin" && pathname.startsWith("/portal")) {
    return "/admin/dashboard";
  }

  if (role === "client" && pathname.startsWith("/admin")) {
    return "/portal/today";
  }

  if (role === "client" && (pathname.startsWith("/portal") || pathname.startsWith("/onboarding"))) {
    if (!hasActiveSubscription) {
      return "/portal/sin-suscripcion";
    }
    if (hasActiveSubscription && !onboardingCompleted && pathname.startsWith("/portal")) {
      return "/onboarding/questionnaire";
    }
  }

  return null;
}
```

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```

Expected: 10/10 passing (8 original + 2 new).

- [ ] **Step 6: Verify TypeScript + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: 0 errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add lib/middleware-utils.ts __tests__/middleware.test.ts app/portal/sin-suscripcion/
git commit -m "feat: enforce subscription gate in middleware and add sin-suscripcion page"
```

---

## End-to-End Smoke Test (manual, after all tasks)

With dev server running AND `stripe listen --forward-to localhost:3000/api/webhooks/stripe` running in a separate terminal:

1. Go to http://localhost:3000/checkout/cuarenta-mas-principiante-poco
2. If not logged in: click "Crear cuenta" → register → confirm email → returned to checkout
3. Click "Continuar al pago" → Stripe Checkout opens
4. Use test card: `4242 4242 4242 4242`, any future date, any CVC, any zip
5. Payment succeeds → Stripe fires webhooks → redirected to `/portal/today`
6. Middleware detects: subscription active + `onboarding_completed=false` → redirects to `/onboarding/questionnaire`
7. Answer the 3 questions → click "Comenzar mi programa"
8. Redirected to `/portal/today` — Fase 1 complete ✅

**Verify in Supabase Dashboard → Table Editor:**
- `subscriptions`: 1 row with `status = active`, `months_elapsed = 1`
- `invoices`: 1 row with the initial payment
- `profiles`: `onboarding_completed = true`
- `onboarding_responses`: 1 row with your answers
