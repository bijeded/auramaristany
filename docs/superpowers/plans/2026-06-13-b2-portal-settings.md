# B2 — `/portal/settings` completo · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/portal/settings` en la pantalla "Mi Cuenta": editar nombre/teléfono y contraseña, subir foto de perfil, ver la suscripción activa (con progreso "Mes X de Y") y consultar el historial de pagos paginado.

**Architecture:** Página Server Component que orquesta carga de datos (`getAccountData`, RLS de dueño) y compone secciones presentacionales + islas cliente. Las escrituras pasan por server actions (`updateAccount`, `updatePassword`) que derivan la identidad de `getUser()`. El avatar sube por un route handler con service-role a un bucket público. Paginación de pagos server-side vía `?page=`.

**Tech Stack:** Next.js App Router (Server Components + server actions), Supabase (`@supabase/ssr` con cookies para lectura/escritura del dueño; `@supabase/supabase-js` service-role para storage y stateless para verificar contraseña), Vitest.

**Spec:** [docs/superpowers/specs/2026-06-13-b2-portal-settings-edicion-design.md](../specs/2026-06-13-b2-portal-settings-edicion-design.md)

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/portal/avatar-validation.ts` | Crear | Validación pura de subida de avatar (tipo/tamaño). |
| `__tests__/avatar-validation.test.ts` | Crear | Tests de la validación. |
| `supabase/migrations/010_avatars_bucket.sql` | Crear | Bucket público `avatars` + policy de lectura. |
| `lib/portal/account-queries.ts` | Crear | `getAccountData(userId)`: perfil + suscripción + invoices (RLS dueño). |
| `__tests__/account-queries.test.ts` | Crear | Tests del mapeo y progreso. |
| `lib/portal/settingsActions.ts` | Crear | Server actions `updateAccount`, `updatePassword`. |
| `__tests__/settings-actions.test.ts` | Crear | Tests de validación/ownership/contraseña. |
| `app/api/portal/avatar/route.ts` | Crear | POST: sube al bucket público, escribe `avatar_url`. |
| `components/portal/settings/SubscriptionCard.tsx` | Crear | Ficha de suscripción + barra "Mes X de Y". |
| `components/portal/settings/PaymentHistory.tsx` | Crear | Lista de pagos + paginación. |
| `components/portal/settings/AccountForm.tsx` | Crear | Form inline nombre/teléfono (cliente). |
| `components/portal/settings/PasswordForm.tsx` | Crear | Form inline contraseña (cliente). |
| `components/portal/settings/AvatarUpload.tsx` | Crear | Subida de avatar (cliente). |
| `components/portal/settings/ProfileHeader.tsx` | Crear | Avatar + nombre + email + toggle editar (cliente). |
| `app/portal/settings/page.tsx` | Reemplazar | Orquesta header + 6 secciones. |

**Convención del repo (respetar):** los tests viven en `__tests__/` en la raíz. Las escrituras a Supabase usan cast `as any` con `// eslint-disable-next-line @typescript-eslint/no-explicit-any` (los tipos no se han regenerado; es backlog D). Estilos con inline `style={{ ... }}` y variables CSS (`var(--lavanda)`, `var(--shadow-card)`, etc.).

**Comando de tests del proyecto:** `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'` (baseline **197**).

---

### Task 1: Validación de avatar (pura, TDD)

**Files:**
- Create: `lib/portal/avatar-validation.ts`
- Test: `__tests__/avatar-validation.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// __tests__/avatar-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateAvatarUpload, MAX_AVATAR_BYTES } from "@/lib/portal/avatar-validation";

describe("validateAvatarUpload", () => {
  it("acepta jpg/png/webp dentro del límite", () => {
    expect(validateAvatarUpload({ size: 1000, type: "image/jpeg" })).toEqual({ ok: true });
    expect(validateAvatarUpload({ size: 1000, type: "image/png" })).toEqual({ ok: true });
    expect(validateAvatarUpload({ size: 1000, type: "image/webp" })).toEqual({ ok: true });
  });

  it("rechaza tipos no permitidos", () => {
    const r = validateAvatarUpload({ size: 1000, type: "image/gif" });
    expect(r.ok).toBe(false);
  });

  it("rechaza archivos que superan el límite", () => {
    const r = validateAvatarUpload({ size: MAX_AVATAR_BYTES + 1, type: "image/jpeg" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run __tests__/avatar-validation.test.ts`
Expected: FAIL ("Cannot find module '@/lib/portal/avatar-validation'").

- [ ] **Step 3: Implementar la validación**

```ts
// lib/portal/avatar-validation.ts
// Validación pura de subida de avatar (sin DOM/DB) → testeable.

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface AvatarUploadCheck {
  size: number;
  type: string;
}

export type AvatarValidation = { ok: true } | { ok: false; error: string };

export function validateAvatarUpload({ size, type }: AvatarUploadCheck): AvatarValidation {
  if (!ALLOWED_AVATAR_TYPES.includes(type)) {
    return { ok: false, error: "Formato no permitido. Usa JPG, PNG o WEBP." };
  }
  if (size > MAX_AVATAR_BYTES) {
    return { ok: false, error: "La imagen supera el límite de 5 MB." };
  }
  return { ok: true };
}

export function avatarExtFor(type: string): "png" | "webp" | "jpg" {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run __tests__/avatar-validation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/portal/avatar-validation.ts __tests__/avatar-validation.test.ts
git commit -m "feat(b2): validación pura de subida de avatar"
```

---

### Task 2: Migración 010 — bucket público `avatars`

**Files:**
- Create: `supabase/migrations/010_avatars_bucket.sql`

> **Aplicación:** este repo no tiene Supabase CLI; la migración se aplica vía Management API (`POST https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query`, `Authorization: Bearer <access-token>` que **provee el usuario** al ejecutar). ⚠ Enviar **cada statement en UNA sola línea** (el pipeline come saltos de línea). Verificar SIEMPRE con consulta de control.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/010_avatars_bucket.sql
-- Bucket público para fotos de perfil. Las escrituras pasan por el route handler
-- con service-role (omite RLS); solo se necesita lectura pública.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
```

- [ ] **Step 2: Aplicar el statement 1 (bucket)**

Pedir al usuario el access token de Supabase si no se tiene. Aplicar en una línea:

Run (sustituir `<TOKEN>`):
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"query":"insert into storage.buckets (id, name, public) values ('"'"'avatars'"'"','"'"'avatars'"'"', true) on conflict (id) do nothing;"}'
```
Expected: `[]` (sin error).

- [ ] **Step 3: Aplicar el statement 2 (policy)**

Run (sustituir `<TOKEN>`):
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"query":"create policy \"avatars_public_read\" on storage.objects for select using (bucket_id = '"'"'avatars'"'"');"}'
```
Expected: `[]` (sin error). Si ya existe la policy, dará error de duplicado → es idempotente a efectos prácticos (ignorar si "already exists").

- [ ] **Step 4: Verificar (consulta de control)**

Run (sustituir `<TOKEN>`):
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/bgvxaagfnzvzamtxqbkg/database/query" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"query":"select id, public from storage.buckets where id = '"'"'avatars'"'"';"}'
```
Expected: `[{"id":"avatars","public":true}]`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/010_avatars_bucket.sql
git commit -m "feat(b2): migración 010 bucket público avatars"
```

---

### Task 3: `getAccountData` (datos de la pantalla, TDD)

**Files:**
- Create: `lib/portal/account-queries.ts`
- Test: `__tests__/account-queries.test.ts`

Lee con el cliente con cookies (RLS de dueño). La suscripción "activa" es la que concede acceso (`active` | `past_due` | `trialing`), la más reciente por `enrollment_date`. Se exponen además helpers puros para el progreso, fáciles de testear.

- [ ] **Step 1: Escribir el test que falla**

```ts
// __tests__/account-queries.test.ts
import { describe, it, expect } from "vitest";
import { mapSubscription, mapInvoices, progressLabel } from "@/lib/portal/account-queries";

describe("mapSubscription", () => {
  it("aplana los joins a un objeto plano", () => {
    const raw = [{
      status: "active", enrollment_date: "2026-01-10", current_period_end: "2026-07-10T00:00:00Z",
      months_elapsed: 3,
      program_variants: { name: "Intermedio", price_mxn: 999, programs: { name: "Fuerza", duration_months: 6 } },
    }];
    expect(mapSubscription(raw)).toEqual({
      program_name: "Fuerza", variant_name: "Intermedio", status: "active",
      enrollment_date: "2026-01-10", current_period_end: "2026-07-10T00:00:00Z",
      price_mxn: 999, months_elapsed: 3, duration_months: 6,
    });
  });

  it("devuelve null si no hay filas", () => {
    expect(mapSubscription([])).toBeNull();
    expect(mapSubscription(null)).toBeNull();
  });
});

describe("mapInvoices", () => {
  it("aplana y conserva el orden recibido", () => {
    const raw = [{
      amount_paid: 999, invoice_date: "2026-03-10", status: "paid",
      subscriptions: { program_variants: { programs: { name: "Fuerza" } } },
    }];
    expect(mapInvoices(raw)).toEqual([
      { amount_paid: 999, invoice_date: "2026-03-10", status: "paid", program_name: "Fuerza" },
    ]);
  });

  it("usa guion cuando falta el programa", () => {
    const raw = [{ amount_paid: 100, invoice_date: "2026-03-10", status: "open", subscriptions: null }];
    expect(mapInvoices(raw)[0].program_name).toBe("—");
  });
});

describe("progressLabel", () => {
  it("formatea Mes X de Y", () => {
    expect(progressLabel(3, 6)).toEqual({ text: "Mes 3 de 6", percent: 50 });
  });
  it("devuelve null si falta la duración", () => {
    expect(progressLabel(3, null)).toBeNull();
  });
  it("clampa el porcentaje a 100", () => {
    expect(progressLabel(8, 6)?.percent).toBe(100);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run __tests__/account-queries.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar `account-queries.ts`**

```ts
// lib/portal/account-queries.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ACCESS_STATES } from "@/lib/content/subscription-access";

export type AccountSubscription = {
  program_name: string;
  variant_name: string;
  status: string;
  enrollment_date: string;
  current_period_end: string | null;
  price_mxn: number;
  months_elapsed: number;
  duration_months: number | null;
};

export type AccountInvoice = {
  invoice_date: string;
  program_name: string;
  amount_paid: number;
  status: string;
};

export type AccountData = {
  profile: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
  subscription: AccountSubscription | null;
  invoices: AccountInvoice[];
};

type RawSub = {
  status: string;
  enrollment_date: string;
  current_period_end: string | null;
  months_elapsed: number;
  program_variants: { name: string; price_mxn: number; programs: { name: string; duration_months: number | null } | null } | null;
};

export function mapSubscription(rows: RawSub[] | null): AccountSubscription | null {
  const r = (rows ?? []).find((x) => x.program_variants);
  if (!r || !r.program_variants) return null;
  return {
    program_name: r.program_variants.programs?.name ?? "—",
    variant_name: r.program_variants.name,
    status: r.status,
    enrollment_date: r.enrollment_date,
    current_period_end: r.current_period_end,
    price_mxn: r.program_variants.price_mxn,
    months_elapsed: r.months_elapsed,
    duration_months: r.program_variants.programs?.duration_months ?? null,
  };
}

type RawInvoice = {
  amount_paid: number;
  invoice_date: string;
  status: string;
  subscriptions: { program_variants: { programs: { name: string } | null } | null } | null;
};

export function mapInvoices(rows: RawInvoice[] | null): AccountInvoice[] {
  return (rows ?? []).map((r) => ({
    amount_paid: r.amount_paid,
    invoice_date: r.invoice_date,
    status: r.status,
    program_name: r.subscriptions?.program_variants?.programs?.name ?? "—",
  }));
}

export function progressLabel(monthsElapsed: number, durationMonths: number | null): { text: string; percent: number } | null {
  if (!durationMonths || durationMonths <= 0) return null;
  const percent = Math.min(100, Math.round((monthsElapsed / durationMonths) * 100));
  return { text: `Mes ${monthsElapsed} de ${durationMonths}`, percent };
}

export async function getAccountData(userId: string): Promise<AccountData> {
  const supabase = await createClient();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, email, phone, avatar_url")
    .eq("id", userId)
    .single();

  const { data: subRows } = await supabase
    .from("subscriptions")
    .select("status, enrollment_date, current_period_end, months_elapsed, program_variants(name, price_mxn, programs(name, duration_months))")
    .eq("profile_id", userId)
    .in("status", ACCESS_STATES as unknown as string[])
    .order("enrollment_date", { ascending: false });

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, status, subscriptions(program_variants(programs(name)))")
    .order("invoice_date", { ascending: false });

  const p = (profileRow ?? {}) as { full_name?: string; email?: string; phone?: string | null; avatar_url?: string | null };
  return {
    profile: {
      full_name: p.full_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? null,
      avatar_url: p.avatar_url ?? null,
    },
    subscription: mapSubscription(subRows as unknown as RawSub[] | null),
    invoices: mapInvoices(invoiceRows as unknown as RawInvoice[] | null),
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run __tests__/account-queries.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/portal/account-queries.ts __tests__/account-queries.test.ts
git commit -m "feat(b2): getAccountData (perfil + suscripción + invoices)"
```

---

### Task 4: `updateAccount` server action (TDD)

**Files:**
- Create: `lib/portal/settingsActions.ts`
- Test: `__tests__/settings-actions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// __tests__/settings-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string; payload?: unknown; eqArgs?: unknown[] }[] = [];
let userId: string | null = "user-1";

const fakeServer = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: userId ? { id: userId, email: "c@x.com" } : null } }),
    updateUser: vi.fn((payload: unknown) => { calls.push({ table: "auth", op: "updateUser", payload }); return Promise.resolve({ error: null }); }),
  },
  from: (table: string) => ({
    update: (payload: unknown) => ({
      eq: (_col: string, val: unknown) => { calls.push({ table, op: "update", payload, eqArgs: [val] }); return Promise.resolve({ error: null }); },
    }),
  }),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => fakeServer) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Cliente stateless para verificar la contraseña actual
const statelessSignIn = vi.fn(() => Promise.resolve({ error: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithPassword: statelessSignIn } })),
}));

import { updateAccount, updatePassword } from "@/lib/portal/settingsActions";

beforeEach(() => { calls.length = 0; userId = "user-1"; statelessSignIn.mockReset(); statelessSignIn.mockResolvedValue({ error: null }); });

describe("updateAccount", () => {
  it("rechaza nombre vacío", async () => {
    const r = await updateAccount({ fullName: "   ", phone: "+52 55 1234 5678" });
    expect(r).toEqual({ ok: false, error: expect.any(String) });
    expect(calls.find((c) => c.op === "update")).toBeUndefined();
  });

  it("rechaza teléfono inválido", async () => {
    const r = await updateAccount({ fullName: "Ana", phone: "123" });
    expect(r.ok).toBe(false);
  });

  it("normaliza el teléfono y escribe con el id de getUser (ignora cualquier id del cliente)", async () => {
    const r = await updateAccount({ fullName: "  Ana López  ", phone: "+52 55 1234 5678" });
    expect(r).toEqual({ ok: true });
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.table).toBe("profiles");
    expect(upd?.payload).toMatchObject({ full_name: "Ana López", phone: "525512345678" });
    expect(upd?.eqArgs).toEqual(["user-1"]);
  });

  it("falla genérico sin sesión", async () => {
    userId = null;
    const r = await updateAccount({ fullName: "Ana", phone: "+52 55 1234 5678" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run __tests__/settings-actions.test.ts -t updateAccount`
Expected: FAIL ("Cannot find module '@/lib/portal/settingsActions'").

- [ ] **Step 3: Implementar `settingsActions.ts` (solo `updateAccount` por ahora)**

```ts
// lib/portal/settingsActions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePhone } from "@/lib/auth/phone";

export type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "No se pudo guardar. Intenta más tarde.";

export async function updateAccount(input: { fullName: string; phone: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  const fullName = input.fullName.trim();
  if (fullName.length === 0) return { ok: false, error: "Ingresa tu nombre." };
  if (fullName.length > 120) return { ok: false, error: "El nombre es demasiado largo." };

  const phoneCheck = validatePhone(input.phone);
  if (!phoneCheck.ok) return { ok: false, error: phoneCheck.error! };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ full_name: fullName, phone: phoneCheck.normalized })
    .eq("id", user.id);

  if (error) {
    console.error("[updateAccount]", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/portal/settings");
  revalidatePath("/portal", "layout");
  return { ok: true };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run __tests__/settings-actions.test.ts -t updateAccount`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/portal/settingsActions.ts __tests__/settings-actions.test.ts
git commit -m "feat(b2): updateAccount server action"
```

---

### Task 5: `updatePassword` server action (TDD)

**Files:**
- Modify: `lib/portal/settingsActions.ts`
- Modify: `__tests__/settings-actions.test.ts`

- [ ] **Step 1: Añadir el bloque de tests de `updatePassword`**

Agregar al final de `__tests__/settings-actions.test.ts`:

```ts
describe("updatePassword", () => {
  it("rechaza nueva menor a 8", async () => {
    const r = await updatePassword({ currentPassword: "oldpass12", newPassword: "short", confirmPassword: "short" });
    expect(r.ok).toBe(false);
  });

  it("rechaza si no coinciden", async () => {
    const r = await updatePassword({ currentPassword: "oldpass12", newPassword: "newpass12", confirmPassword: "otra1234" });
    expect(r.ok).toBe(false);
  });

  it("rechaza si la nueva es igual a la actual", async () => {
    const r = await updatePassword({ currentPassword: "samepass1", newPassword: "samepass1", confirmPassword: "samepass1" });
    expect(r.ok).toBe(false);
  });

  it("rechaza si la contraseña actual es incorrecta", async () => {
    statelessSignIn.mockResolvedValueOnce({ error: { message: "invalid" } });
    const r = await updatePassword({ currentPassword: "wrongpass", newPassword: "newpass12", confirmPassword: "newpass12" });
    expect(r).toEqual({ ok: false, error: "La contraseña actual es incorrecta." });
    expect(calls.find((c) => c.op === "updateUser")).toBeUndefined();
  });

  it("cambia la contraseña tras verificar la actual", async () => {
    const r = await updatePassword({ currentPassword: "oldpass12", newPassword: "newpass12", confirmPassword: "newpass12" });
    expect(r).toEqual({ ok: true });
    expect(statelessSignIn).toHaveBeenCalledWith({ email: "c@x.com", password: "oldpass12" });
    expect(calls.find((c) => c.op === "updateUser")?.payload).toMatchObject({ password: "newpass12" });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run __tests__/settings-actions.test.ts -t updatePassword`
Expected: FAIL ("updatePassword is not a function").

- [ ] **Step 3: Añadir `updatePassword` a `settingsActions.ts`**

Añadir el import del cliente stateless al inicio del archivo (tras los imports existentes):

```ts
import { createClient as createStatelessClient } from "@supabase/supabase-js";
```

Y añadir la función al final del archivo:

```ts
export async function updatePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: GENERIC_ERROR };

  if (input.newPassword.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (input.newPassword !== input.confirmPassword) return { ok: false, error: "Las contraseñas no coinciden." };
  if (input.newPassword === input.currentPassword) return { ok: false, error: "La nueva contraseña debe ser distinta a la actual." };

  // Verifica la contraseña actual con un cliente SIN cookies (no toca la sesión activa).
  const stateless = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: signInError } = await stateless.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (signInError) return { ok: false, error: "La contraseña actual es incorrecta." };

  const { error: updateError } = await supabase.auth.updateUser({ password: input.newPassword });
  if (updateError) {
    console.error("[updatePassword]", updateError);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Correr toda la suite del archivo**

Run: `npx vitest run __tests__/settings-actions.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/portal/settingsActions.ts __tests__/settings-actions.test.ts
git commit -m "feat(b2): updatePassword server action (verifica actual sin tocar sesión)"
```

---

### Task 6: Route handler de subida de avatar

**Files:**
- Create: `app/api/portal/avatar/route.ts`

Espejo de [app/api/portal/photos/route.ts](../../../app/api/portal/photos/route.ts) pero con bucket público, ruta fija por usuario y `upsert`. Se valida en el smoke manual (subida real).

- [ ] **Step 1: Crear el route handler**

```ts
// app/api/portal/avatar/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateAvatarUpload, avatarExtFor } from "@/lib/portal/avatar-validation";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }

  const check = validateAvatarUpload({ size: file.size, type: file.type });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const ext = avatarExtFor(file.type);
  const path = `${user.id}/avatar.${ext}`;

  const admin = createServiceClient();
  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (uploadError) {
    console.error("[avatar upload]", uploadError);
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  // Cache-bust: la ruta es fija (upsert), así el navegador no sirve la versión vieja.
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (admin as any)
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (dbError) {
    console.error("[avatar db]", dbError);
    return NextResponse.json({ error: "No se pudo guardar la imagen." }, { status: 500 });
  }

  return NextResponse.json({ url });
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add app/api/portal/avatar/route.ts
git commit -m "feat(b2): route handler de subida de avatar (bucket público)"
```

---

### Task 7: `SubscriptionCard` (presentacional)

**Files:**
- Create: `components/portal/settings/SubscriptionCard.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// components/portal/settings/SubscriptionCard.tsx
import type { AccountSubscription } from "@/lib/portal/account-queries";
import { progressLabel } from "@/lib/portal/account-queries";

const STATUS_BADGE: Record<string, { text: string; bg: string; color: string }> = {
  active: { text: "Activa", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  trialing: { text: "Prueba", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  past_due: { text: "Pago pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  canceled: { text: "Cancelada", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  unpaid: { text: "Sin pagar", bg: "var(--error-tint)", color: "var(--error)" },
};

function formatDate(iso: string): string {
  return new Date(`${iso.split("T")[0]}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatMoney(mxn: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(mxn);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 items-center" style={{ marginBottom: 12 }}>
      <span className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>{label}</span>
      <span className="font-body text-sm font-medium text-right" style={{ color: "var(--negro)" }}>{children}</span>
    </div>
  );
}

export function SubscriptionCard({ subscription }: { subscription: AccountSubscription | null }) {
  if (!subscription) {
    return (
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>
          No tienes una suscripción activa.
        </p>
      </div>
    );
  }

  const badge = STATUS_BADGE[subscription.status] ?? STATUS_BADGE.canceled;
  const progress = progressLabel(subscription.months_elapsed, subscription.duration_months);

  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <Row label="Programa">
        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ background: "var(--lavanda-tint)", color: "var(--lavanda-dark)" }}>
          {subscription.program_name} · {subscription.variant_name}
        </span>
      </Row>
      <Row label="Estado">
        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ background: badge.bg, color: badge.color }}>
          {badge.text}
        </span>
      </Row>
      <Row label="Fecha de inicio">{formatDate(subscription.enrollment_date)}</Row>
      {subscription.current_period_end && (
        <Row label="Próximo cobro">
          {formatDate(subscription.current_period_end)} · {formatMoney(subscription.price_mxn)}
        </Row>
      )}
      {progress && (
        <div style={{ marginTop: 16 }}>
          <div className="flex justify-between" style={{ marginBottom: 6 }}>
            <span className="font-body text-xs font-semibold" style={{ color: "var(--negro)" }}>{progress.text}</span>
            <span className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>{progress.percent}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--gris-linea)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress.percent}%`, background: "var(--lavanda)" }} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/portal/settings/SubscriptionCard.tsx
git commit -m "feat(b2): SubscriptionCard con progreso Mes X de Y"
```

---

### Task 8: `PaymentHistory` (presentacional + paginación)

**Files:**
- Create: `components/portal/settings/PaymentHistory.tsx`

Recibe los invoices **ya paginados** + `{ page, totalPages }`. Los controles de página son links `?page=N#pagos` (el ancla preserva el scroll a la sección).

- [ ] **Step 1: Crear el componente**

```tsx
// components/portal/settings/PaymentHistory.tsx
import Link from "next/link";
import type { AccountInvoice } from "@/lib/portal/account-queries";
import { STATUS_LABEL } from "@/lib/admin/payment-status";

function formatDate(iso: string): string {
  return new Date(`${iso.split("T")[0]}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatMoney(mxn: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(mxn);
}

export function PaymentHistory({
  invoices, page, totalPages,
}: { invoices: AccountInvoice[]; page: number; totalPages: number }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>Aún no tienes pagos registrados.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex flex-col">
        {invoices.map((inv, i) => {
          const badge = STATUS_LABEL[inv.status] ?? STATUS_LABEL.void;
          return (
            <div key={`${inv.invoice_date}-${i}`} className="flex items-center justify-between gap-3 py-3"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--gris-linea)" }}>
              <div className="min-w-0">
                <p className="font-body text-sm font-medium truncate" style={{ color: "var(--negro)" }}>{inv.program_name}</p>
                <p className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>{formatDate(inv.invoice_date)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-body text-sm font-medium" style={{ color: "var(--negro)" }}>{formatMoney(inv.amount_paid)}</span>
                <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: badge.bg, color: badge.color }}>
                  {badge.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between" style={{ marginTop: 14 }}>
          {page > 1 ? (
            <Link href={`/portal/settings?page=${page - 1}#pagos`} className="font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>← Anterior</Link>
          ) : <span />}
          <span className="font-body text-xs" style={{ color: "var(--gris-suave)" }}>Página {page} de {totalPages}</span>
          {page < totalPages ? (
            <Link href={`/portal/settings?page=${page + 1}#pagos`} className="font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>Siguiente →</Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/portal/settings/PaymentHistory.tsx
git commit -m "feat(b2): PaymentHistory con paginación 10/página"
```

---

### Task 9: Formularios inline `AccountForm` y `PasswordForm` (cliente)

**Files:**
- Create: `components/portal/settings/AccountForm.tsx`
- Create: `components/portal/settings/PasswordForm.tsx`

- [ ] **Step 1: Crear `AccountForm.tsx`**

```tsx
// components/portal/settings/AccountForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validatePhone } from "@/lib/auth/phone";
import { updateAccount } from "@/lib/portal/settingsActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountForm({
  initialName, initialPhone, onDone,
}: { initialName: string; initialPhone: string; onDone?: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) { setError(phoneCheck.error!); return; }
    if (fullName.trim().length === 0) { setError("Ingresa tu nombre."); return; }

    setLoading(true);
    const res = await updateAccount({ fullName, phone });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setSuccess(true);
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" style={{ marginTop: 14 }}>
      <div className="space-y-1.5">
        <Label htmlFor="acc-name">Nombre completo</Label>
        <Input id="acc-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acc-phone">Núm. Celular (con lada de país)</Label>
        <Input id="acc-phone" type="tel" autoComplete="tel" placeholder="+52 55 1234 5678"
          value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>
      {error && <p className="text-sm font-medium" style={{ color: "var(--error)" }}>{error}</p>}
      {success && <p className="text-sm font-medium" style={{ color: "var(--exito)" }}>Datos actualizados.</p>}
      <Button type="submit" disabled={loading} className="w-full font-head font-medium"
        style={{ background: "var(--lavanda)", color: "#fff" }}>
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Crear `PasswordForm.tsx`**

```tsx
// components/portal/settings/PasswordForm.tsx
"use client";

import { useState } from "react";
import { updatePassword } from "@/lib/portal/settingsActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);
    setLoading(true);
    const res = await updatePassword({ currentPassword, newPassword, confirmPassword });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setSuccess(true);
    setCurrent(""); setNew(""); setConfirm("");
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" style={{ marginTop: 14 }}>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-current">Contraseña actual</Label>
        <Input id="pwd-current" type="password" autoComplete="current-password"
          value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-new">Nueva contraseña</Label>
        <Input id="pwd-new" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres"
          value={newPassword} onChange={(e) => setNew(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-confirm">Confirmar nueva contraseña</Label>
        <Input id="pwd-confirm" type="password" autoComplete="new-password"
          value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <p className="text-sm font-medium" style={{ color: "var(--error)" }}>{error}</p>}
      {success && <p className="text-sm font-medium" style={{ color: "var(--exito)" }}>Contraseña actualizada.</p>}
      <Button type="submit" disabled={loading} className="w-full font-head font-medium"
        style={{ background: "var(--lavanda)", color: "#fff" }}>
        {loading ? "Guardando..." : "Guardar contraseña"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/portal/settings/AccountForm.tsx components/portal/settings/PasswordForm.tsx
git commit -m "feat(b2): formularios inline de cuenta y contraseña"
```

---

### Task 10: `AvatarUpload` y `ProfileHeader` (cliente)

**Files:**
- Create: `components/portal/settings/AvatarUpload.tsx`
- Create: `components/portal/settings/ProfileHeader.tsx`

- [ ] **Step 1: Crear `AvatarUpload.tsx`**

```tsx
// components/portal/settings/AvatarUpload.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AvatarUpload({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/portal/avatar", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo subir la imagen.");
      return;
    }
    const { url: newUrl } = await res.json();
    setUrl(newUrl);
    router.refresh();
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto" }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} width={96} height={96}
            style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--lavanda-tint)",
            color: "var(--lavanda-dark)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 600 }}>
            {initials(name)}
          </div>
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
          aria-label="Cambiar foto de perfil"
          style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: "50%",
            background: "var(--lavanda)", border: "3px solid var(--rosa-soft)", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Camera size={15} color="#fff" />
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
      </div>
      {loading && <p className="font-body text-xs" style={{ color: "var(--gris-suave)", marginTop: 8 }}>Subiendo...</p>}
      {error && <p className="font-body text-xs" style={{ color: "var(--error)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Crear `ProfileHeader.tsx`**

```tsx
// components/portal/settings/ProfileHeader.tsx
"use client";

import { useState } from "react";
import { AvatarUpload } from "./AvatarUpload";
import { AccountForm } from "./AccountForm";
import { Button } from "@/components/ui/button";

export function ProfileHeader({
  fullName, email, phone, avatarUrl,
}: { fullName: string; email: string; phone: string | null; avatarUrl: string | null }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <AvatarUpload name={fullName} avatarUrl={avatarUrl} />
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <h2 className="font-head text-lg font-semibold" style={{ color: "var(--negro)" }}>{fullName || "—"}</h2>
        <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>{email}</p>
        <Button variant="outline" className="mt-3" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancelar" : "Editar perfil"}
        </Button>
      </div>
      {editing && (
        <AccountForm initialName={fullName} initialPhone={phone ?? ""} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/portal/settings/AvatarUpload.tsx components/portal/settings/ProfileHeader.tsx
git commit -m "feat(b2): ProfileHeader + AvatarUpload con iniciales de respaldo"
```

---

### Task 11: Cablear la página `/portal/settings`

**Files:**
- Replace: `app/portal/settings/page.tsx`

Compone header + las 6 secciones. La sección de seguridad usa un pequeño toggle inline; para mantener la página como Server Component, ese toggle vive en un mini componente cliente. Creamos `SecuritySection.tsx` junto a los demás.

- [ ] **Step 1: Crear `components/portal/settings/SecuritySection.tsx`**

```tsx
// components/portal/settings/SecuritySection.tsx
"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { PasswordForm } from "./PasswordForm";

export function SecuritySection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full" style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <Lock size={18} color="var(--gris-texto)" />
        <span className="font-body text-sm font-medium flex-1" style={{ color: "var(--negro)" }}>Cambiar contraseña</span>
        <span className="font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>{open ? "Cerrar" : "Editar"}</span>
      </button>
      {open && <PasswordForm onDone={() => setOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar `app/portal/settings/page.tsx`**

```tsx
// app/portal/settings/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountData } from "@/lib/portal/account-queries";
import { paginate } from "@/lib/admin/pagination";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProfileHeader } from "@/components/portal/settings/ProfileHeader";
import { SubscriptionCard } from "@/components/portal/settings/SubscriptionCard";
import { SecuritySection } from "@/components/portal/settings/SecuritySection";
import { PaymentHistory } from "@/components/portal/settings/PaymentHistory";

// Etiqueta de fecha para el PortalHeader (respeta DEV_DATE en dev, como /pilares).
function todayLabel(): string {
  const base = process.env.DEV_DATE ? new Date(`${process.env.DEV_DATE}T12:00:00`) : new Date();
  return base.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-head text-xs uppercase tracking-wider" style={{ color: "var(--gris-suave)", margin: "22px 0 10px" }}>
      {children}
    </h2>
  );
}

// Next 14: searchParams es un objeto plano (NO Promise, no se hace await).
export default async function PortalSettingsPage({
  searchParams,
}: { searchParams: { page?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const data = await getAccountData(user.id);
  const { items, page, totalPages } = paginate(data.invoices, Number(searchParams.page) || 1, 10);

  return (
    <>
      <PortalHeader dateLabel={todayLabel()} />
      <div className="p-5">
        <h1 className="font-head text-xl mb-2" style={{ color: "var(--negro)" }}>Mi cuenta</h1>

        <ProfileHeader
          fullName={data.profile.full_name}
          email={data.profile.email || user.email || ""}
          phone={data.profile.phone}
          avatarUrl={data.profile.avatar_url}
        />

        <SectionTitle>Mi programa</SectionTitle>
        <SubscriptionCard subscription={data.subscription} />

        <SectionTitle>Seguridad</SectionTitle>
        <SecuritySection />

        <div id="pagos" />
        <SectionTitle>Historial de pagos</SectionTitle>
        <PaymentHistory invoices={items} page={page} totalPages={totalPages} />

        <div style={{ marginTop: 24 }}>
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Correr build**

Run: `npm run build`
Expected: build verde (la ruta `/portal/settings` compila como dinámica).

- [ ] **Step 5: Commit**

```bash
git add app/portal/settings/page.tsx components/portal/settings/SecuritySection.tsx
git commit -m "feat(b2): cablear /portal/settings (header + 6 secciones)"
```

---

### Task 12: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: PASS. Baseline 197 + nuevos (avatar-validation 3, account-queries 7, settings-actions 9) = **216** aprox. Confirmar 0 fallos.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores, build verde.

- [ ] **Step 3: Lint (si el repo lo usa en CI)**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Smoke manual (lo hace el usuario)**

Checklist para el usuario en `npm run dev` con sesión de cliente:
1. `/portal/settings` muestra header (logo + fecha), perfil, suscripción, seguridad, pagos, logout.
2. Editar perfil → cambiar nombre/teléfono → "Datos actualizados" y persiste al recargar.
3. Subir foto → aparece el avatar (y reemplaza las iniciales); recargar mantiene la foto.
4. Cambiar contraseña con actual incorrecta → mensaje de error; con la correcta → "Contraseña actualizada" y permite re-login.
5. Historial de pagos pagina de 10 en 10 (si hay >10 invoices).
6. Suscripción muestra "Mes X de Y".

---

## Notas de ejecución

- **Worktree:** el repo no tiene remoto → `git config worktree.baseRef head` antes de `EnterWorktree`. `node_modules` del worktree nace vacío → symlinkear al del repo principal. Copiar `.env.local` (si no, el build falla con `STRIPE_SECRET_KEY is not set`).
- **Migración (Task 2):** requiere el access token de Supabase del usuario; pedirlo al llegar a esa tarea. Sin el bucket, la subida de avatar falla en smoke (pero el resto funciona).
- **Orden recomendado:** Tasks 1→12 en secuencia. Tasks 1,3,4,5 son TDD puro y se pueden validar sin servidor. La 2 (migración) puede ir en paralelo pero el smoke del avatar la necesita.
```
