# Diseño — Núm. Celular obligatorio en el registro · Fase 6

**Fecha:** 10 de junio de 2026
**Fase:** 6 (Pulido + Launch), sub-bloque 4a
**Estado de partida:** El registro (`/auth/register` → `RegisterForm`) captura nombre/correo/contraseña y crea la cuenta con `supabase.auth.signUp({ options: { data: { full_name } } })`. El trigger `handle_new_user()` copia `raw_user_meta_data->>'full_name'` a `profiles.full_name`. `profiles.phone` casi siempre es null → el botón WhatsApp admin→cliente (Fase 4) no aparece.

## Objetivo

Capturar el **número de celular** (obligatorio, con lada de país) al crear la cuenta, persistiéndolo en `profiles.phone`, para activar la mensajería por WhatsApp (`wa.me/<número>`, que necesita el número con código de país). Decisión del usuario: capturarlo en el registro, no en onboarding/checkout.

## 1. Validación (helper puro, TDD)

Nuevo `lib/auth/phone.ts`:

```
normalizePhone(raw: string): string
  - elimina todo lo que no sea dígito (quita '+', espacios, guiones, paréntesis).

validatePhone(raw: string): { ok: boolean; error?: string; normalized: string }
  - normalized = normalizePhone(raw).
  - ok si 11 ≤ normalized.length ≤ 15 (E.164 máx 15; ≥11 obliga a incluir lada de país,
    p.ej. México 52 + 10 dígitos = 12).
  - error claro si está vacío / muy corto (probable falta de lada) / muy largo / sin dígitos.
```

Mensajes: vacío → "Ingresa tu número de celular."; fuera de rango → "Incluye la lada de país (ej. +52 55 1234 5678)."

## 2. UI — `components/auth/RegisterForm.tsx`

- Nuevo campo **"Núm. Celular (con lada de país)"** entre Nombre completo y Correo:
  - `type="tel"`, `required`, `autoComplete="tel"`, placeholder `+52 55 1234 5678`.
  - Texto de ayuda debajo: *"Incluye la lada de país. Ej: +52 55 1234 5678"*.
- Estado local `phone` (igual que `fullName`).
- En `handleSubmit`, antes del `signUp`: `const v = validatePhone(phone); if (!v.ok) { setError(v.error); return; }` (junto a las validaciones de contraseña existentes).
- Pasar el número **normalizado** en el metadata: `options: { data: { full_name: fullName, phone: v.normalized } }`.

## 3. Persistencia — Migración 008

Actualizar `handle_new_user()` para copiar también el teléfono, **preservando** `security definer` + `set search_path = public` (la función viva ya tiene este fix; la migración debe re-declararlo para no perderlo):

```sql
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

- `profiles.phone` **queda nullable** (NO se hace NOT NULL): cuentas viejas (phone null) y usuarios creados por la Auth Admin API sin metadata `phone` no se rompen. Lo "obligatorio" se exige en el form.
- Aplicar vía Management API (un solo `create or replace`), verificando después que la función viva incluye `phone` y conserva `search_path`.

## 4. Edge cases

- **Cuenta sin `phone` en metadata** (usuario por API): `nullif(null,'')` = null; el trigger inserta phone=null sin fallar.
- **Validación client-side** (consistente con la validación de contraseña actual; `signUp` corre desde el navegador, sin server action intermedia). Riesgo bajo: un bypass enviaría phone vacío → null en DB (no rompe nada).
- **Número con `+`, espacios, guiones o paréntesis:** `normalizePhone` los limpia; se guarda solo dígitos (formato que `wa.me` espera).

## 5. Testing

- **TDD** de `lib/auth/phone.ts`:
  - `normalizePhone`: quita `+`, espacios, guiones, paréntesis; deja solo dígitos.
  - `validatePhone`: válido (12 dígitos MX), válido en límites (11 y 15), rechazo de vacío, de 10 dígitos (sin lada), de >15, y de entrada sin dígitos.
- Verificación: `npm run test:run` + `npx tsc --noEmit` + `npm run build` limpios.
- **Smoke manual:** registrar una cuenta nueva con celular → confirmar `profiles.phone` poblado (DB) → abrir la ficha admin de ese cliente y ver el botón "Enviar WhatsApp" activo.

## 6. Fuera de alcance (follow-ups)

- **Backfill / edición del teléfono de cuentas existentes** (hoy null): no hay UI de admin para editar `profiles.phone`; los clientes previos no tendrán WhatsApp hasta que se re-registren o exista esa UI. Anotado.
- Hacer `profiles.phone` NOT NULL a nivel DB (descartado por compatibilidad).
- Validación server-side del teléfono (el flujo de registro es client-side hoy; no se cambia).

Ver [[project_aura]], [[feedback_project_approach]].
