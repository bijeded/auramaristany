# Ciclo de Corrección de Seguridad Fase 6 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los 5 hallazgos medios de la auditoría (DEF-1, SUB-1, INP-3, INP-2, RLS-1) + bonus (RLS-2, HYG-1), sin tocar funcionalidad existente.

**Architecture:** Defensa en profundidad. Helpers puros testeables (decisión de rol, acceso por suscripción, validación de input, sanitización HTML) + wiring fino en server-actions/queries/páginas. Una migración 009 idempotente para RLS y trigger. Patrón del repo: lógica pura en `lib/**` con tests en `__tests__/`, server-actions delgadas.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres RLS), TypeScript, vitest, zod (ya instalado), sanitize-html (a instalar).

**Spec:** docs/superpowers/specs/2026-06-11-fase6-fixes-seguridad-design.md

---

## Notas de ejecución

- **Worktree:** este ciclo SÍ modifica código → ejecutar en worktree (preferencia del usuario). El repo no tiene remoto: `git config worktree.baseRef head` antes de `EnterWorktree`. Copiar `.env.local` del repo principal al worktree (gitignored) o el build falla con `STRIPE_SECRET_KEY is not set`.
- **Tests:** correr `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`. Baseline actual: 159 pasando.
- **Migración 009:** aplicar vía Management API `POST https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query` con `Authorization: Bearer <token>` (pedir al usuario; puede estar rotado). ⚠ **SQL en UNA SOLA LÍNEA** (el pipeline come saltos de línea → comentarios `--` autocomentan todo → `[]` silencioso). Verificar SIEMPRE con consulta de control.
- **TDD:** los puros (`decideAdminAccess`, `subscriptionGrantsAccess`, validadores, `sanitizeRichText`) van test-first.

---

### Task 1: DEF-1 · Módulo `lib/admin/auth.ts` compartido (decisión pura + wrappers)

**Files:**
- Create: `lib/admin/auth.ts`
- Create: `__tests__/admin-auth.test.ts`
- Modify: `lib/admin/messageActions.ts:33-46` (eliminar `requireAdmin` local, importar del módulo)

- [ ] **Step 1: Test de la decisión pura (falla)**

`__tests__/admin-auth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { decideAdminAccess } from "@/lib/admin/auth";

describe("decideAdminAccess", () => {
  it("rechaza sin usuario", () => {
    expect(decideAdminAccess(null, null)).toEqual({ ok: false, error: "No autenticado" });
  });
  it("rechaza usuario no-admin", () => {
    expect(decideAdminAccess({ id: "u1" }, "client")).toEqual({ ok: false, error: "No autorizado" });
  });
  it("rechaza rol nulo", () => {
    expect(decideAdminAccess({ id: "u1" }, null)).toEqual({ ok: false, error: "No autorizado" });
  });
  it("acepta admin", () => {
    expect(decideAdminAccess({ id: "u1" }, "admin")).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Correr el test (falla por módulo inexistente)**

Run: `npx vitest run __tests__/admin-auth.test.ts`
Expected: FAIL ("Cannot find module '@/lib/admin/auth'").

- [ ] **Step 3: Implementar `lib/admin/auth.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AdminDecision = { ok: true } | { ok: false; error: string };

// Decisión pura (testeable) separada del wiring de Supabase.
export function decideAdminAccess(
  user: { id: string } | null,
  role: string | null | undefined
): AdminDecision {
  if (!user) return { ok: false, error: "No autenticado" };
  if (role !== "admin") return { ok: false, error: "No autorizado" };
  return { ok: true };
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type AdminAuth =
  | { ok: true; supabase: SupabaseServer; user: { id: string } }
  | { ok: false; error: string };

// Verifica sesión + rol admin. Para server-actions: devuelve {ok,error}.
export async function requireAdmin(): Promise<AdminAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const decision = decideAdminAccess(user, (prof as { role?: string } | null)?.role);
  if (!decision.ok) return decision;
  return { ok: true, supabase, user: user! };
}

// Para Server Components de páginas admin: redirige si no es admin.
export async function requireAdminPage(): Promise<void> {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/portal/today");
}
```

- [ ] **Step 4: Correr el test (pasa)**

Run: `npx vitest run __tests__/admin-auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `messageActions.ts` para usar el módulo**

En `lib/admin/messageActions.ts`: borrar la función `requireAdmin` local (líneas 33-46, incluido el comentario de cabecera) y añadir el import al inicio:
```ts
import { requireAdmin } from "./auth";
```
(Las llamadas `await requireAdmin()` en sendMessage/getSentMessageDetail/deleteMessage no cambian: la firma es idéntica.)

- [ ] **Step 6: Verificar tipos + suite**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: tsc limpio; suite verde (163 tests: 159 + 4 nuevos).

- [ ] **Step 7: Commit**

```bash
git add lib/admin/auth.ts __tests__/admin-auth.test.ts lib/admin/messageActions.ts
git commit -m "feat(sec): requireAdmin compartido en lib/admin/auth (DEF-1)"
```

---

### Task 2: DEF-1 · Aplicar `requireAdmin()` en dayActions/pillarActions/onboardingActions

**Files:**
- Modify: `lib/admin/dayActions.ts` (saveDay, saveBlocks, deleteDay, cloneDay, cloneWeek)
- Modify: `lib/admin/pillarActions.ts` (savePillar, savePillarBlocks)
- Modify: `lib/admin/onboardingActions.ts` (saveQuestion, reorderQuestions, setQuestionActive)

- [ ] **Step 1: dayActions — import + guard al inicio de cada action**

Añadir import: `import { requireAdmin } from "./auth";`

En cada action, **antes** del `const supabase = await createClient();`, insertar el guard y reusar el `supabase` del auth. Para `saveDay` (retorna `{dayId, error}`):
```ts
export async function saveDay(data: SaveDayInput): Promise<{ dayId: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { dayId: data.id ?? "", error: auth.error };
  const supabase = auth.supabase;
  // ...resto igual
```
Para `saveBlocks`/`deleteDay`/`cloneWeek` (retornan `{error}`):
```ts
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
```
Para `cloneDay` (retorna `{dayId?, error}`):
```ts
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
```
En cada caso, **eliminar** la línea `const supabase = await createClient();` que se reemplaza. `cloneWeek` usa `(supabase as any)` directamente y llama a `cloneDay` (que ya revalida) — añadir el guard al inicio de `cloneWeek` también.

- [ ] **Step 2: pillarActions — import + guard**

Añadir `import { requireAdmin } from "./auth";`. En `savePillar` (retorna `{pillarId, error}`):
```ts
  const auth = await requireAdmin();
  if (!auth.ok) return { pillarId: "", error: auth.error };
  const supabase = auth.supabase;
```
En `savePillarBlocks` (retorna `{error}`):
```ts
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
```
Eliminar los `const supabase = await createClient();` reemplazados.

- [ ] **Step 3: onboardingActions — import + guard**

Añadir `import { requireAdmin } from "./auth";`. En `saveQuestion` (retorna `{id, error}`), insertar el guard **antes** de `validateQuestion` no es necesario; ponerlo al inicio:
```ts
export async function saveQuestion(input: QuestionInput): Promise<{ id: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { id: input.id ?? "", error: auth.error };
  const v = validateQuestion(input);
  if (!v.ok) return { id: input.id ?? "", error: v.error };
  const supabase = auth.supabase;
  // ...resto igual (eliminar el createClient local)
```
En `reorderQuestions` y `setQuestionActive` (retornan `{error}`):
```ts
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
```
Eliminar los `const supabase = await createClient();` reemplazados. (El `createClient` import puede quedar sin uso → quitarlo si tsc avisa.)

- [ ] **Step 4: Verificar tipos + suite**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: tsc limpio; suite verde (163).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/dayActions.ts lib/admin/pillarActions.ts lib/admin/onboardingActions.ts
git commit -m "feat(sec): verificación de rol admin en server-actions de contenido (DEF-1)"
```

---

### Task 3: DEF-1 · `requireAdmin` en clients-queries + `requireAdminPage` en páginas admin

**Files:**
- Modify: `lib/admin/clients-queries.ts` (`getClientsList`, `getClientDetail`)
- Modify: `app/admin/dashboard/page.tsx`, `app/admin/clients/page.tsx`, `app/admin/clients/[clientId]/page.tsx`, `app/admin/payments/page.tsx`, `app/admin/messages/page.tsx`, `app/admin/onboarding-settings/page.tsx`

- [ ] **Step 1: clients-queries — guard que lanza**

Añadir `import { requireAdmin } from "./auth";` al inicio de `lib/admin/clients-queries.ts`. Al inicio de `getClientsList` y `getClientDetail`, antes de cualquier query:
```ts
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
```
(Las funciones siguen creando su propio cliente como hoy; el guard es defensa de último recurso. No cambiar el resto.)

- [ ] **Step 2: Añadir `requireAdminPage()` a cada página admin**

En cada `page.tsx` admin, añadir el import y la llamada como **primera** sentencia del componente async (antes de cualquier fetch). Ejemplo para `app/admin/dashboard/page.tsx`:
```ts
import { requireAdminPage } from "@/lib/admin/auth";
// ...
export default async function DashboardPage() {
  await requireAdminPage();
  // ...resto igual
```
Repetir el patrón (mismo import + `await requireAdminPage();` como primera línea del componente) en: `app/admin/clients/page.tsx`, `app/admin/clients/[clientId]/page.tsx`, `app/admin/payments/page.tsx`, `app/admin/messages/page.tsx`, `app/admin/onboarding-settings/page.tsx`. Si alguna página recibe `params`/`searchParams`, mantenerlos; la llamada va igual como primera línea del cuerpo.

- [ ] **Step 3: Verificar tipos + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc limpio; build verde. (`.env.local` debe estar en el worktree.)

- [ ] **Step 4: Commit**

```bash
git add lib/admin/clients-queries.ts app/admin
git commit -m "feat(sec): guard de rol admin en queries service-role y páginas admin (DEF-1)"
```

---

### Task 4: SUB-1 · Helper `subscriptionGrantsAccess` + unificar los 3 sitios

**Files:**
- Create: `lib/content/subscription-access.ts`
- Create: `__tests__/subscription-access.test.ts`
- Modify: `middleware.ts:54` (`.eq("status","active")` → `.in`)
- Modify: `lib/content/queries.ts:112` (`.eq("status","active")` → `.in`)
- Modify: `lib/content/history.ts:127` (`.eq("status","active")` → `.in`)

- [ ] **Step 1: Test del helper (falla)**

`__tests__/subscription-access.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { subscriptionGrantsAccess, ACCESS_STATES } from "@/lib/content/subscription-access";

describe("subscriptionGrantsAccess", () => {
  it.each(["active", "trialing", "past_due"])("concede acceso a %s", (s) => {
    expect(subscriptionGrantsAccess(s)).toBe(true);
  });
  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "desconocido"])(
    "niega acceso a %s",
    (s) => {
      expect(subscriptionGrantsAccess(s)).toBe(false);
    }
  );
  it("ACCESS_STATES es la fuente de verdad", () => {
    expect([...ACCESS_STATES]).toEqual(["active", "trialing", "past_due"]);
  });
});
```

- [ ] **Step 2: Correr el test (falla)**

Run: `npx vitest run __tests__/subscription-access.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar el helper**

`lib/content/subscription-access.ts`:
```ts
// Fuente única de verdad: qué estados de suscripción conceden acceso al portal.
// Decisión de negocio (2026-06-11): active + trialing + past_due (ventana de
// gracia de Stripe; past_due muestra banner). Ampliar/reducir AQUÍ se propaga
// a middleware, getTodayContent y getPerformanceData.
export const ACCESS_STATES = ["active", "trialing", "past_due"] as const;

export function subscriptionGrantsAccess(status: string): boolean {
  return (ACCESS_STATES as readonly string[]).includes(status);
}
```

- [ ] **Step 4: Correr el test (pasa)**

Run: `npx vitest run __tests__/subscription-access.test.ts`
Expected: PASS.

- [ ] **Step 5: Usar `ACCESS_STATES` en middleware.ts**

Añadir import al inicio: `import { ACCESS_STATES } from "@/lib/content/subscription-access";`. Reemplazar en la query de suscripción (línea ~54):
```ts
        .eq("profile_id", user.id)
        .in("status", ACCESS_STATES as readonly string[])
        .maybeSingle();
```

- [ ] **Step 6: Usar `ACCESS_STATES` en queries.ts (getTodayContent)**

Añadir import `import { ACCESS_STATES } from "./subscription-access";`. Reemplazar (línea ~112):
```ts
    .eq("profile_id", userId)
    .in("status", ACCESS_STATES as readonly string[])
    .single();
```

- [ ] **Step 7: Usar `ACCESS_STATES` en history.ts (getPerformanceData)**

Añadir import `import { ACCESS_STATES } from "./subscription-access";`. Reemplazar (línea ~127):
```ts
    .eq("profile_id", userId)
    .in("status", ACCESS_STATES as readonly string[])
    .single();
```
**Nota:** `.single()` puede romper si hay >1 sub que concede acceso. Es improbable (una sub activa por cliente) pero, por robustez, cambiar `.single()` a `.maybeSingle()` en queries.ts y history.ts si tsc/tests lo permiten — mantener `.single()` si el comportamiento actual ya lo asumía. Decisión: **conservar `.single()`** (igual que hoy) para no alterar el contrato; el riesgo de multi-sub no es nuevo.

- [ ] **Step 8: Verificar tipos + suite**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: tsc limpio; suite verde (166).

- [ ] **Step 9: Commit**

```bash
git add lib/content/subscription-access.ts __tests__/subscription-access.test.ts middleware.ts lib/content/queries.ts lib/content/history.ts
git commit -m "feat(sec): acceso por suscripción unificado (active/trialing/past_due) (SUB-1)"
```

---

### Task 5: SUB-1 · Banner "Pago pendiente" en el portal

**Files:**
- Create: `components/portal/PaymentPendingBanner.tsx`
- Modify: `app/portal/layout.tsx`

- [ ] **Step 1: Crear el componente del banner**

`components/portal/PaymentPendingBanner.tsx`:
```tsx
export function PaymentPendingBanner() {
  return (
    <div
      role="status"
      className="px-4 py-3 text-sm text-center"
      style={{ background: "#fff4e5", color: "#8a5a00", borderBottom: "1px solid #ffe0b2" }}
    >
      Tu último pago está pendiente. Mantienes el acceso mientras se procesa; si el
      problema persiste, actualiza tu método de pago para no perder tu programa.
    </div>
  );
}
```

- [ ] **Step 2: Consultar estado `past_due` en el layout y renderizar el banner**

En `app/portal/layout.tsx`, tras obtener `user`, consultar si la sub está en `past_due`. Añadir import `import { PaymentPendingBanner } from "@/components/portal/PaymentPendingBanner";` y, dentro del componente:
```ts
  const { data: pastDue } = user
    ? await supabase.from("subscriptions").select("id").eq("profile_id", user.id).eq("status", "past_due").maybeSingle()
    : { data: null };
```
Renderizar el banner sobre `<main>`:
```tsx
        {pastDue ? <PaymentPendingBanner /> : null}
        <main className="flex-1 overflow-y-auto">{children}</main>
```

- [ ] **Step 3: Verificar tipos + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc limpio; build verde.

- [ ] **Step 4: Commit**

```bash
git add components/portal/PaymentPendingBanner.tsx app/portal/layout.tsx
git commit -m "feat(sec): banner de pago pendiente para suscripción past_due (SUB-1)"
```

---

### Task 6: INP-3 · Mensaje genérico de error en el registro

**Files:**
- Modify: `components/auth/RegisterForm.tsx:57-62`

- [ ] **Step 1: Reemplazar `error.message` crudo por mensaje genérico**

En `components/auth/RegisterForm.tsx`, en el bloque tras `signUp` (línea ~57):
```ts
    if (error) {
      // No exponer error.message crudo: evita enumeración de cuentas
      // (distinguir "email ya registrado" de otros fallos). INP-3.
      setError("No se pudo completar el registro. Verifica tus datos o intenta más tarde.");
      setLoading(false);
      return;
    }
```
(Las validaciones client-side previas de phone/password/confirmación NO cambian: no revelan existencia de cuentas.)

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add components/auth/RegisterForm.tsx
git commit -m "feat(sec): mensaje genérico en registro contra enumeración de cuentas (INP-3)"
```

---

### Task 7: INP-2 · Validación de input en actions de contenido

**Files:**
- Create: `lib/admin/content-validation.ts`
- Create: `__tests__/content-validation.test.ts`
- Modify: `lib/admin/dayActions.ts` (saveDay, saveBlocks)
- Modify: `lib/admin/pillarActions.ts` (savePillarBlocks)

- [ ] **Step 1: Test de los validadores (falla)**

`__tests__/content-validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateDayInput, validateBlock } from "@/lib/admin/content-validation";

describe("validateDayInput", () => {
  const base = { title: "Día 1", weekNumber: 1, dayType: "workout", durationMinutes: 30, workoutFocus: "Fuerza" };
  it("acepta input válido", () => {
    expect(validateDayInput(base).ok).toBe(true);
  });
  it("rechaza title vacío", () => {
    expect(validateDayInput({ ...base, title: "  " }).ok).toBe(false);
  });
  it("rechaza title >200", () => {
    expect(validateDayInput({ ...base, title: "x".repeat(201) }).ok).toBe(false);
  });
  it("rechaza weekNumber fuera de 1–4", () => {
    expect(validateDayInput({ ...base, weekNumber: 5 }).ok).toBe(false);
    expect(validateDayInput({ ...base, weekNumber: 0 }).ok).toBe(false);
  });
  it("rechaza dayType fuera del enum", () => {
    expect(validateDayInput({ ...base, dayType: "yoga" }).ok).toBe(false);
  });
  it("rechaza durationMinutes fuera de 0–600", () => {
    expect(validateDayInput({ ...base, durationMinutes: 601 }).ok).toBe(false);
  });
  it("acepta durationMinutes null y workoutFocus null", () => {
    expect(validateDayInput({ ...base, durationMinutes: null, workoutFocus: null }).ok).toBe(true);
  });
});

describe("validateBlock", () => {
  it("acepta block_type permitido", () => {
    expect(validateBlock({ block_type: "text", content: { html: "<p>hola</p>" } }).ok).toBe(true);
  });
  it("rechaza block_type desconocido", () => {
    expect(validateBlock({ block_type: "iframe", content: {} }).ok).toBe(false);
  });
  it("rechaza html de texto >50000", () => {
    expect(validateBlock({ block_type: "text", content: { html: "x".repeat(50001) } }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test (falla)**

Run: `npx vitest run __tests__/content-validation.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar los validadores con zod**

`lib/admin/content-validation.ts`:
```ts
import { z } from "zod";

export type ValidationResult = { ok: true } | { ok: false; error: string };

const DAY_TYPES = ["workout", "rest", "cardio"] as const;
const BLOCK_TYPES = ["text", "youtube", "pdf", "image", "cardio_zone2", "exercise_list"] as const;

const daySchema = z.object({
  title: z.string().trim().min(1).max(200),
  weekNumber: z.number().int().min(1).max(4),
  dayType: z.enum(DAY_TYPES),
  durationMinutes: z.number().int().min(0).max(600).nullable(),
  workoutFocus: z.string().max(120).nullable(),
});

export function validateDayInput(input: unknown): ValidationResult {
  const r = daySchema.safeParse(input);
  return r.success ? { ok: true } : { ok: false, error: "Datos del día inválidos" };
}

export function validateBlock(block: { block_type: string; content: Record<string, unknown> }): ValidationResult {
  if (!(BLOCK_TYPES as readonly string[]).includes(block.block_type)) {
    return { ok: false, error: "Tipo de bloque no permitido" };
  }
  if (block.block_type === "text") {
    const html = (block.content as { html?: unknown }).html;
    if (typeof html === "string" && html.length > 50000) {
      return { ok: false, error: "Contenido de texto demasiado largo" };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Correr el test (pasa)**

Run: `npx vitest run __tests__/content-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Aplicar `validateDayInput` en saveDay**

En `lib/admin/dayActions.ts` `saveDay`, tras el guard de `requireAdmin` (Task 2):
```ts
  const valid = validateDayInput({
    title: data.title, weekNumber: data.weekNumber, dayType: data.dayType,
    durationMinutes: data.durationMinutes, workoutFocus: data.workoutFocus,
  });
  if (!valid.ok) return { dayId: data.id ?? "", error: valid.error };
```
Añadir import: `import { validateDayInput, validateBlock } from "./content-validation";`

- [ ] **Step 6: Aplicar `validateBlock` en saveBlocks**

En `saveBlocks` (dayActions.ts), tras el guard, antes del delete:
```ts
  for (const b of blocks) {
    const v = validateBlock(b);
    if (!v.ok) return { error: v.error };
  }
```

- [ ] **Step 7: Aplicar `validateBlock` en savePillarBlocks**

En `lib/admin/pillarActions.ts` `savePillarBlocks`, tras el guard, antes del delete:
```ts
  for (const b of blocks) {
    const v = validateBlock(b);
    if (!v.ok) return { error: v.error };
  }
```
Añadir import: `import { validateBlock } from "./content-validation";`

- [ ] **Step 8: Verificar tipos + suite**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: tsc limpio; suite verde (176).

- [ ] **Step 9: Commit**

```bash
git add lib/admin/content-validation.ts __tests__/content-validation.test.ts lib/admin/dayActions.ts lib/admin/pillarActions.ts
git commit -m "feat(sec): validación de input server-side en actions de contenido (INP-2)"
```

---

### Task 8: INP-2 · Sanitización del HTML de Tiptap

**Files:**
- Modify: `package.json` (añadir `sanitize-html` + `@types/sanitize-html`)
- Create: `lib/admin/sanitize-html.ts`
- Create: `__tests__/sanitize-html.test.ts`
- Modify: `lib/admin/dayActions.ts` (saveBlocks), `lib/admin/pillarActions.ts` (savePillarBlocks)

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install sanitize-html && npm install -D @types/sanitize-html`
Expected: añadidas a package.json sin errores.

- [ ] **Step 2: Test del sanitizador (falla)**

`__tests__/sanitize-html.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "@/lib/admin/sanitize-html";

describe("sanitizeRichText", () => {
  it("elimina <script>", () => {
    expect(sanitizeRichText('<p>hola</p><script>alert(1)</script>')).toBe("<p>hola</p>");
  });
  it("elimina handlers on*", () => {
    expect(sanitizeRichText('<p onclick="evil()">hola</p>')).toBe("<p>hola</p>");
  });
  it("elimina javascript: en href", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
  it("preserva formato legítimo de Tiptap", () => {
    const html = "<h2>Título</h2><p><strong>negrita</strong> y <em>cursiva</em></p><ul><li>uno</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });
  it("preserva enlaces con href http", () => {
    expect(sanitizeRichText('<a href="https://x.com">x</a>')).toContain('href="https://x.com"');
  });
});
```

- [ ] **Step 3: Correr el test (falla)**

Run: `npx vitest run __tests__/sanitize-html.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 4: Implementar el sanitizador**

`lib/admin/sanitize-html.ts`:
```ts
import sanitizeHtml from "sanitize-html";

// Whitelist conservadora para el output de Tiptap (starter-kit + posibles enlaces).
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "code", "pre", "blockquote",
      "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a",
    ],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
```

- [ ] **Step 5: Correr el test (pasa)**

Run: `npx vitest run __tests__/sanitize-html.test.ts`
Expected: PASS. (Si `preserva formato` falla por normalización de sanitize-html, ajustar el `expected` del test a la salida normalizada — documentar la forma exacta esperada, no relajar la whitelist.)

- [ ] **Step 6: Sanitizar bloques de texto en saveBlocks (dayActions)**

En `saveBlocks` (dayActions.ts), al construir `rows`, sanitizar el html de bloques de texto:
```ts
    const rows = blocks.map((b, i) => ({
      day_id: dayId,
      block_type: b.block_type,
      sort_order: i,
      content:
        b.block_type === "text" && typeof (b.content as { html?: unknown }).html === "string"
          ? { ...b.content, html: sanitizeRichText((b.content as { html: string }).html) }
          : b.content,
    }));
```
Añadir import: `import { sanitizeRichText } from "./sanitize-html";`

- [ ] **Step 7: Sanitizar bloques de texto en savePillarBlocks (pillarActions)**

En `savePillarBlocks` (pillarActions.ts), en el `.map` del insert, aplicar la misma transformación de `content` que en el Step 6. Añadir import: `import { sanitizeRichText } from "./sanitize-html";`

- [ ] **Step 8: Verificar tipos + suite + build**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npm run build`
Expected: tsc limpio; suite verde (181); build verde.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/admin/sanitize-html.ts __tests__/sanitize-html.test.ts lib/admin/dayActions.ts lib/admin/pillarActions.ts
git commit -m "feat(sec): sanitización del HTML de Tiptap al guardar (INP-2)"
```

---

### Task 9: Migración 009 · RLS-1 + RLS-2 + HYG-1 + normalización de phone (INP-3)

**Files:**
- Create: `supabase/migrations/009_security_hardening.sql`

- [ ] **Step 1: Escribir la migración (idempotente)**

`supabase/migrations/009_security_hardening.sql`:
```sql
-- ============================================================
-- 009 — Endurecimiento de seguridad (post-auditoría Fase 6)
-- RLS-1: with check explícito en políticas for-all de datos de cliente.
-- RLS-2: with check en messages_admin_write.
-- HYG-1: search_path explícito en is_admin().
-- INP-3: normalización server-side de phone en handle_new_user().
-- ============================================================

-- RLS-1 — progress_logs
drop policy if exists "progress_logs_own_or_admin" on progress_logs;
create policy "progress_logs_own_or_admin"
  on progress_logs for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- RLS-1 — body_metrics
drop policy if exists "body_metrics_own_or_admin" on body_metrics;
create policy "body_metrics_own_or_admin"
  on body_metrics for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- RLS-1 — onboarding_responses
drop policy if exists "onboarding_responses_own_or_admin" on onboarding_responses;
create policy "onboarding_responses_own_or_admin"
  on onboarding_responses for all
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- RLS-2 — messages_admin_write
drop policy if exists "messages_admin_write" on messages;
create policy "messages_admin_write"
  on messages for all
  using (is_admin())
  with check (is_admin());

-- HYG-1 — is_admin() con search_path fijado
create or replace function is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- INP-3 — handle_new_user() normaliza phone server-side
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  raw_phone text := nullif(new.raw_user_meta_data->>'phone', '');
  norm_phone text := nullif(regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g'), '');
begin
  insert into profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when length(coalesce(norm_phone, '')) between 11 and 15 then norm_phone else null end
  );
  return new;
end;
$$;
```

- [ ] **Step 2: Commit del archivo de migración**

```bash
git add supabase/migrations/009_security_hardening.sql
git commit -m "feat(sec): migración 009 — with check RLS, search_path, phone normalizado (RLS-1/2, HYG-1, INP-3)"
```

- [ ] **Step 3: Aplicar la migración vía Management API (UNA SOLA LÍNEA por statement)**

⚠ Pedir al usuario el access-token de Supabase (puede estar rotado). Aplicar **cada `create/drop` en una sola línea** (sin saltos de línea, sin comentarios `--`), una por request, al endpoint `POST https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query`. Son 6 statements de policy (3 drop + 3 create... en realidad pares drop+create por política) + las 2 funciones. Enviar cada statement individual colapsado a una línea.

- [ ] **Step 4: Verificar la aplicación con consultas de control**

Ejecutar (también en una línea):
- `select polname, pg_get_expr(polwithcheck, polrelid) as with_check from pg_policy where polname in ('progress_logs_own_or_admin','body_metrics_own_or_admin','onboarding_responses_own_or_admin','messages_admin_write');`
  Expected: las 4 con `with_check` no nulo.
- `select pg_get_functiondef('is_admin'::regproc);` → contiene `SET search_path TO public`.
- `select pg_get_functiondef('handle_new_user'::regproc);` → contiene la normalización `regexp_replace` y `between 11 and 15`.

- [ ] **Step 5: Smoke de la normalización de phone (opcional, con token)**

Crear un usuario de prueba con phone `+52 (55) 1234-5678` en metadata vía Auth Admin API y confirmar `profiles.phone = '525512345678'`; borrar el usuario de prueba.

---

## Self-Review (writing-plans)

- **Cobertura del spec:**
  - DEF-1 → Tasks 1 (módulo + messageActions), 2 (server-actions), 3 (queries + páginas). ✓
  - SUB-1 → Tasks 4 (helper + 3 sitios), 5 (banner). ✓
  - INP-3 → Task 6 (mensaje genérico) + Task 9 Step 1 (phone server-side). ✓
  - INP-2 → Tasks 7 (validación), 8 (sanitización). ✓
  - RLS-1 + bonus RLS-2/HYG-1 → Task 9. ✓
  - Criterio de completitud (suite/tsc/build verdes, migración verificada) → pasos de verificación en cada task + Task 9 Steps 4-5. ✓
- **Placeholder scan:** sin TBD/TODO; cada step de código muestra el código real con rutas y líneas. La nota de Task 8 Step 5 sobre ajustar el `expected` es una contingencia explícita, no un placeholder. ✓
- **Consistencia de tipos/nombres:** `requireAdmin` devuelve `{ok, supabase, user}` (Task 1) y se consume igual en Tasks 2-3-7-8; `ACCESS_STATES`/`subscriptionGrantsAccess` consistentes (Task 4-5); `validateDayInput`/`validateBlock`/`sanitizeRichText` mismas firmas entre definición (Tasks 7-8) y uso. ✓
- **Conteo de tests:** baseline 159 → +4 (T1) +3 (T4) +10 (T7) +5 (T8) = 181 esperados al final.
