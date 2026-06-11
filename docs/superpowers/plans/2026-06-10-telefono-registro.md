# Núm. Celular obligatorio en el registro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar el número de celular (obligatorio, con lada de país) en `/auth/register` y persistirlo en `profiles.phone`, para activar el botón WhatsApp admin→cliente.

**Architecture:** Helper puro de validación (`lib/auth/phone.ts`, TDD) usado por `RegisterForm` para validar y normalizar el número antes de `supabase.auth.signUp` (pasado en `options.data.phone`); migración 008 que actualiza el trigger `handle_new_user()` para copiar el teléfono del metadata a `profiles.phone`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase Auth + trigger SQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-telefono-registro-design.md`

---

## File Structure

**Crear:**
- `lib/auth/phone.ts` — `normalizePhone`, `validatePhone` (puras).
- `__tests__/phone.test.ts` — tests TDD.
- `supabase/migrations/008_handle_new_user_phone.sql` — actualiza el trigger.

**Modificar:**
- `components/auth/RegisterForm.tsx` — campo "Núm. Celular" + validación + metadata.

---

### Task 1: Helper de validación de teléfono (TDD)

**Files:**
- Create: `lib/auth/phone.ts`
- Create: `__tests__/phone.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/phone.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizePhone, validatePhone } from "@/lib/auth/phone";

describe("normalizePhone", () => {
  it("deja solo dígitos (quita +, espacios, guiones, paréntesis)", () => {
    expect(normalizePhone("+52 55 1234-5678")).toBe("525512345678");
    expect(normalizePhone("(55) 1234 5678")).toBe("5512345678");
  });
  it("string sin dígitos => vacío", () => {
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("validatePhone", () => {
  it("acepta un número MX con lada (12 dígitos)", () => {
    const r = validatePhone("+52 55 1234 5678");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("525512345678");
  });
  it("acepta los límites 11 y 15 dígitos", () => {
    expect(validatePhone("15551234567").ok).toBe(true);      // 11
    expect(validatePhone("123456789012345").ok).toBe(true);  // 15
  });
  it("rechaza vacío con mensaje de captura", () => {
    const r = validatePhone("");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Ingresa tu número de celular.");
  });
  it("rechaza 10 dígitos (sin lada de país)", () => {
    const r = validatePhone("5512345678");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("lada de país");
  });
  it("rechaza más de 15 dígitos", () => {
    expect(validatePhone("1234567890123456").ok).toBe(false);
  });
  it("entrada sin dígitos se trata como vacía", () => {
    expect(validatePhone("abc").error).toBe("Ingresa tu número de celular.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- phone`
Expected: FAIL — `Cannot find module '@/lib/auth/phone'`.

- [ ] **Step 3: Write the implementation**

Create `lib/auth/phone.ts`:

```ts
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function validatePhone(raw: string): { ok: boolean; error?: string; normalized: string } {
  const normalized = normalizePhone(raw);
  if (normalized.length === 0) {
    return { ok: false, error: "Ingresa tu número de celular.", normalized };
  }
  if (normalized.length < 11 || normalized.length > 15) {
    return { ok: false, error: "Incluye la lada de país (ej. +52 55 1234 5678).", normalized };
  }
  return { ok: true, normalized };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- phone`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/phone.ts __tests__/phone.test.ts
git commit -m "feat: helper de validación de teléfono (normalizePhone/validatePhone) (TDD)"
```

---

### Task 2: Campo "Núm. Celular" en RegisterForm

**Files:**
- Modify: `components/auth/RegisterForm.tsx`

- [ ] **Step 1: Add the import and state**

In `components/auth/RegisterForm.tsx`:

1. Add the import below the existing imports (after the `createClient` import on line 6):

```ts
import { validatePhone } from "@/lib/auth/phone";
```

2. Add a `phone` state right after the `fullName` state (line 13 is `const [fullName, setFullName] = useState("");`):

```ts
  const [phone, setPhone] = useState("");
```

- [ ] **Step 2: Add the phone validation in handleSubmit**

In `handleSubmit`, the current validation block is:

```ts
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
```

Add the phone check immediately BEFORE the `password !== confirmPassword` check:

```ts
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) {
      setError(phoneCheck.error!);
      return;
    }
```

- [ ] **Step 3: Pass the normalized phone in the signUp metadata**

In `handleSubmit`, the current `data` is:

```ts
        data: { full_name: fullName },
```

Change it to:

```ts
        data: { full_name: fullName, phone: phoneCheck.normalized },
```

- [ ] **Step 4: Add the phone field in the form**

In the form JSX, the "Nombre completo" field block ends with `</div>` right before the "Correo electrónico" block. The current markup is:

```tsx
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            placeholder="María Elena García"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
```

Insert this new field block between the `fullName` `</div>` and the `email` `<div>`:

```tsx
        <div className="space-y-1.5">
          <Label htmlFor="phone">Núm. Celular (con lada de país)</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+52 55 1234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
          />
          <p className="text-xs" style={{ color: "var(--gris-texto)" }}>
            Incluye la lada de país. Ej: +52 55 1234 5678
          </p>
        </div>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/auth/RegisterForm.tsx
git commit -m "feat: campo Núm. Celular obligatorio en el registro (valida + manda a signUp)"
```

---

### Task 3: Migración 008 (trigger `handle_new_user` con phone) + verificación

**Files:**
- Create: `supabase/migrations/008_handle_new_user_phone.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/008_handle_new_user_phone.sql`:

```sql
-- ============================================================
-- 008 — handle_new_user() copia también el teléfono del metadata
-- a profiles.phone (capturado en /auth/register). Preserva
-- security definer + set search_path = public (fix ya aplicado
-- a la función viva; se re-declara para no perderlo).
-- profiles.phone sigue nullable: cuentas sin metadata 'phone'
-- (p.ej. usuarios creados por la Auth Admin API) no se rompen.
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;
```

- [ ] **Step 2: Typecheck + tests (the migration file doesn't affect TS, but confirm nothing else broke)**

Run: `npm run test:run` and `npx tsc --noEmit`
Expected: all green (incluye `phone`), no type errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_handle_new_user_phone.sql
git commit -m "feat: migración 008 — handle_new_user copia phone a profiles"
```

- [ ] **Step 4: Apply the migration in Supabase (controller step)**

> Esto lo hace el controller (no el subagente): aplicar el `create or replace function` vía la **Management API** (un solo statement, sin el problema de batches multi-statement) contra el proyecto `bgvxaagfnzvzamtxqbkg`. Necesita el access token de Supabase del usuario (puede haber sido rotado; pedir uno nuevo si el anterior ya no sirve). Tras aplicar, verificar con `pg_get_functiondef` que la función viva incluye `phone` y conserva `set search_path = public`.

- [ ] **Step 5: Build + manual smoke (controller step)**

Run: `npm run build` (con `.env.local`) — build limpio.

Smoke manual:
1. Registrar una cuenta nueva en `/auth/register` con un número de celular con lada (ej. `+52 55 1234 5678`); confirmar que la validación rechaza vacío y 10 dígitos.
2. Tras confirmar el correo y crear la cuenta, verificar en DB que `profiles.phone` quedó poblado con los dígitos normalizados.
3. Abrir la ficha admin de ese cliente (`/admin/clients/[clientId]` → tab Mensajes) y confirmar que aparece el botón "Enviar WhatsApp".

---

## Notas de verificación contra el spec

- **Validación 11–15 dígitos + normalización** → Task 1 (TDD).
- **Campo "Núm. Celular (con lada de país)" requerido + ayuda + metadata** → Task 2.
- **Migración 008 (trigger copia phone, preserva search_path, phone nullable)** → Task 3.
- **Edge case usuario sin metadata phone** → `nullif(... , '')` en Task 3.
- **Smoke (registro → profiles.phone → botón WhatsApp)** → Task 3 Step 5.
- **Fuera de alcance** (backfill de cuentas viejas, NOT NULL, validación server-side) → no hay tareas (correcto).
```
