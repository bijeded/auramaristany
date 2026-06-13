# B2 — `/portal/settings` con edición (perfil, suscripción, pagos) — Diseño

**Fecha:** 13 de junio de 2026
**Sub-bloque:** Fase 6 · B2 (necesario para el MVP)
**Estado previo:** `/portal/settings` existe en solo-lectura ([app/portal/settings/page.tsx](../../../app/portal/settings/page.tsx)): muestra nombre, correo y teléfono + logout. Esta es la versión completa de la pantalla "Mi Cuenta".
**Referencia de diseño:** [design-handoff-aura/prototype/aura/client-settings.jsx](../../../design-handoff-aura/prototype/aura/client-settings.jsx) (orientativa, no replicar al pixel).

---

## Objetivo

Convertir `/portal/settings` en la pantalla "Mi Cuenta" del cliente: editar sus datos de cuenta, subir foto de perfil, ver su suscripción activa y consultar su historial de pagos paginado. Toda escritura deriva la identidad del servidor (`getUser()`), nunca de props del cliente (hallazgo INP-4 de la auditoría).

## Decisiones tomadas (brainstorm)

1. **Campos editables:** nombre, teléfono y contraseña. **Email solo-lectura permanente** (no se podrá cambiar ni ahora ni después).
2. **Contraseña:** se pide la **actual + nueva + confirmar**. La actual se re-verifica antes de cambiarla.
3. **Foto de perfil:** subida a un **bucket público** `avatars`; si no hay foto, **avatar genérico con iniciales**.
4. **Ficha de suscripción:** datos disponibles **+ barra de progreso "Mes X de Y"**.
5. **Historial de pagos:** sección propia con **paginación de 10 entradas**.
6. **Edición:** **formularios inline** que se expanden en la misma página (el repo no tiene componente modal/Sheet; no se introduce esa primitiva).

## Fuera de alcance (confirmado)

- Método de pago / tarjeta (no se almacena) y botón "Gestionar en Stripe" (no hay Customer Portal todavía).
- Edición de email.
- Sin nueva primitiva de modal/Sheet.

---

## Arquitectura

`/portal/settings/page.tsx` sigue siendo un **Server Component**. Orquesta la carga de datos y renderiza secciones presentacionales; los formularios interactivos y la subida de avatar son **islas cliente** que invocan server actions / un route handler. La paginación de pagos es server-side vía `?page=` (re-render del server, sin estado cliente).

### Capas y responsabilidades

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Página | `app/portal/settings/page.tsx` | `getUser()`, llama a `getAccountData`, calcula `dateLabel` (respeta `DEV_DATE`), lee `?page=`, compone secciones. |
| Datos | `lib/portal/account-queries.ts` | `getAccountData(userId)`: perfil + suscripción (joins) + invoices. Mapea a tipos planos testables. |
| Acciones | `lib/portal/settingsActions.ts` | `updateAccount`, `updatePassword` (server actions). |
| Subida | `app/api/portal/avatar/route.ts` | POST: valida, sube al bucket público, escribe `profiles.avatar_url`. |
| Validación | `lib/portal/avatar-validation.ts` | Tope de tamaño + tipos permitidos (espejo de [photo-validation](../../../lib/portal/photo-validation.ts)). |
| UI (server) | `components/portal/settings/SubscriptionCard.tsx`, `PaymentHistory.tsx` | Presentacionales (reciben datos ya mapeados). |
| UI (cliente) | `components/portal/settings/ProfileHeader.tsx`, `AvatarUpload.tsx`, `AccountForm.tsx`, `PasswordForm.tsx` | Islas interactivas. |
| Reuso | [PortalHeader](../../../components/portal/PortalHeader.tsx), [LogoutButton](../../../components/auth/LogoutButton.tsx), [paginate](../../../lib/admin/pagination.ts), [STATUS_LABEL](../../../lib/admin/payment-status.ts), [validatePhone](../../../lib/auth/phone.ts), [createServiceClient](../../../lib/supabase/service.ts) | — |

---

## Secciones de la pantalla (orden vertical)

1. **Header** — `PortalHeader` (logo AURA + fecha). La fecha se calcula como en `/portal/messages` y `/portal/pilares`: `process.env.DEV_DATE ? new Date(\`${DEV_DATE}T12:00:00\`) : new Date()`, formateada en español.
2. **Perfil** — avatar (foto del bucket o iniciales), nombre, correo (solo-lectura). Botón "Editar perfil" expande `AccountForm`. Botón cámara sobre el avatar dispara `AvatarUpload`.
3. **Mi programa** (`SubscriptionCard`) — `programa · variante`, estado (badge), fecha de inicio (`enrollment_date`), próximo cobro (`current_period_end`) + monto (`price_mxn`), barra **"Mes `months_elapsed` de `duration_months`"**. Si no hay suscripción activa: estado vacío discreto.
4. **Seguridad** — fila "Cambiar contraseña" que expande `PasswordForm`.
5. **Historial de pagos** (`PaymentHistory`) — filas (fecha, programa, monto, estado con `STATUS_LABEL`), **paginación 10/página** vía links `?page=N`. Estado vacío si no hay invoices.
6. **Cerrar sesión** — `LogoutButton`.

---

## Detalle de componentes / contratos

### `lib/portal/account-queries.ts`

```ts
type AccountSubscription = {
  program_name: string;       // programs.name
  variant_name: string;       // program_variants.name
  status: string;             // 'active' | 'past_due' | 'canceled' | 'unpaid'
  enrollment_date: string;    // fecha de inicio (date)
  current_period_end: string | null; // próximo cobro
  price_mxn: number;          // monto
  months_elapsed: number;     // mes actual
  duration_months: number | null;    // total de meses del programa
};

type AccountInvoice = {
  invoice_date: string;
  program_name: string;
  amount_paid: number;
  status: string;             // clave de STATUS_LABEL
};

type AccountData = {
  profile: { full_name: string; email: string; phone: string | null; avatar_url: string | null };
  subscription: AccountSubscription | null;   // la activa (active|past_due) más reciente
  invoices: AccountInvoice[];                  // del cliente, orden invoice_date desc
};

export async function getAccountData(userId: string): Promise<AccountData>;
```

- Lee con el **cliente con cookies** (RLS de dueño: `subscriptions_own_or_admin`, `invoices_own_or_admin`, `profiles_select_own_or_admin`). No usa service-role.
- Suscripción: elige la que concede acceso (estados de [ACCESS_STATES](../../../lib/content/subscription-access.ts), excluyendo `canceled`), join a `program_variants(name, price_mxn, programs(name, duration_months))`.
- Mapea joins anidados a tipos planos (sigue el estilo de [finance-queries](../../../lib/admin/finance-queries.ts)).

### `lib/portal/settingsActions.ts`

```ts
type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateAccount(input: { fullName: string; phone: string }): Promise<ActionResult>;
export async function updatePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<ActionResult>;
```

**`updateAccount`:**
1. `getUser()` → si no hay sesión, `{ ok:false }` genérico.
2. Valida `fullName`: `trim()`, no vacío, ≤ 120 chars → si no, error específico ("Ingresa tu nombre.").
3. Valida teléfono con `validatePhone(phone)` → usa `normalized`.
4. `update profiles set full_name, phone where id = user.id` (identidad del server, **ignora cualquier id del cliente**).
5. En error de Postgres: `console.error` server-side + mensaje genérico al cliente (INP-1).
6. `revalidatePath("/portal/settings")` y `revalidatePath("/portal", "layout")` (nombre/teléfono aparecen en otras vistas).

**`updatePassword`:**
1. `getUser()` → email del usuario.
2. Valida: `newPassword` ≥ 8, `newPassword === confirmPassword`, `newPassword !== currentPassword` → errores específicos.
3. **Re-verifica la actual** con un cliente *stateless* (`@supabase/supabase-js` con anon key, `persistSession:false`): `signInWithPassword({ email, password: currentPassword })`. Si falla → "La contraseña actual es incorrecta." (no rota la sesión activa porque el cliente no persiste cookies).
4. Con el **cliente con cookies** (sesión activa): `auth.updateUser({ password: newPassword })`.
5. Error → log server-side + mensaje genérico. Éxito → `{ ok:true }`.

### `app/api/portal/avatar/route.ts` (POST)

Espejo de [photos/route.ts](../../../app/api/portal/photos/route.ts):
1. `getUser()` → 401 si no.
2. `formData()` → `file` (File). `validateAvatarUpload({ size, type })`.
3. `ext` por tipo; `path = \`${user.id}/avatar.${ext}\``.
4. `createServiceClient().storage.from("avatars").upload(path, file, { upsert: true })`.
5. URL pública: `storage.from("avatars").getPublicUrl(path)` → con cache-bust (`?v=Date.now()`) para que el navegador no sirva la vieja al re-subir con misma ruta.
6. `update profiles set avatar_url = <url> where id = user.id`.
7. Devuelve `{ url }`. El cliente actualiza estado + `router.refresh()`.

### `lib/portal/avatar-validation.ts`

`validateAvatarUpload({ size, type })`: tipos `image/jpeg|png|webp`, tamaño ≤ 5 MB. Devuelve `{ ok, error? }`. Mismo contrato que [photo-validation](../../../lib/portal/photo-validation.ts).

### Componentes UI

- **`ProfileHeader.tsx`** (cliente): avatar (img si `avatar_url`, si no iniciales de `full_name` sobre fondo lavanda), botón cámara → `AvatarUpload`. Nombre + correo (solo-lectura). Botón "Editar perfil" alterna `AccountForm`.
- **`AvatarUpload.tsx`** (cliente): input file oculto, sube vía `fetch("/api/portal/avatar")`, estado loading/error, `router.refresh()` al éxito.
- **`AccountForm.tsx`** (cliente, inline): inputs nombre + teléfono (valores iniciales por props), `useState`, valida teléfono con `validatePhone` antes de llamar, invoca `updateAccount`, error inline + éxito ("Datos actualizados"), `router.refresh()`.
- **`PasswordForm.tsx`** (cliente, inline): inputs actual + nueva + confirmar, invoca `updatePassword`, error inline + éxito ("Contraseña actualizada"), limpia campos al éxito.
- **`SubscriptionCard.tsx`** (presentacional): recibe `AccountSubscription | null`. Badge de estado (helper local: `active`→"Activa"/verde, `past_due`→"Pago pendiente"/ámbar, `canceled`→"Cancelada"/gris, `unpaid`→"Sin pagar"/rojo). Barra "Mes X de Y" (oculta si `duration_months` nulo).
- **`PaymentHistory.tsx`** (presentacional): recibe `AccountInvoice[]` ya paginados + `{ page, totalPages }`. Filas con `STATUS_LABEL`. Controles de página como links `?page=N` (preservan scroll a la sección). Estado vacío.

Estilo: tarjetas `rounded-xl bg-white` + `var(--shadow-card)`, acentos `var(--lavanda)`, tipografía `font-head`/`font-body`, como el resto del portal.

---

## Migración 010 — bucket `avatars`

Crea el bucket público y su policy de lectura. Las **escrituras pasan por el route handler con service-role** (que omite RLS), así que no se requieren policies de insert/update para el usuario.

Statements (se aplican vía Management API, **uno por línea**, con verificación posterior):
1. `insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;`
2. Policy de `select` público sobre `storage.objects` para `bucket_id = 'avatars'`.

**Verificación:** consultar `storage.buckets` (que `public = true`) y `pg_policies` para la policy creada.

> ⚠ Gotcha del proyecto: el pipeline de la Management API come saltos de línea → enviar **cada statement en UNA sola línea** y verificar con consulta de control (no fiarse del `[]` silencioso).

---

## Manejo de errores

- Server actions: errores de validación → mensaje específico en español; errores de infraestructura (Postgres/Supabase) → `console.error` server-side + mensaje genérico ("No se pudo guardar. Intenta más tarde."). Nunca se devuelve `error.message` crudo (INP-1/INP-3).
- Subida de avatar: error de validación → 400 con mensaje; error de storage → 500 genérico.
- `getAccountData`: si no hay suscripción, `subscription: null` (la UI muestra estado vacío, no error).

---

## Testing

- **`lib/portal/settingsActions.test.ts`** (mock de Supabase, estilo existente):
  - `updateAccount`: nombre vacío → error; teléfono inválido → error; éxito normaliza teléfono y escribe con el `id` de `getUser()` (ignora cualquier id provisto); sin sesión → error genérico.
  - `updatePassword`: nueva < 8 → error; no coinciden → error; igual a la actual → error; actual incorrecta (mock de `signInWithPassword` con error) → "contraseña actual incorrecta"; éxito llama `updateUser`.
- **`lib/portal/account-queries.test.ts`**: mapeo de joins anidados a tipos planos; cálculo de "Mes X de Y"; sin suscripción → `null`; orden de invoices.
- **`lib/portal/avatar-validation.test.ts`**: tipos/tamaños válidos e inválidos.
- El route de avatar y los componentes UI se validan en el **smoke manual** (subida real al bucket).

Baseline actual: **197 tests**. Meta: verde tras añadir los nuevos.

---

## Riesgos / notas

- **Cache-bust del avatar**: la ruta fija `${user.id}/avatar.ext` + `upsert` reusa la URL; sin `?v=` el navegador muestra la foto vieja. Resuelto con query de versión.
- **Cliente stateless para verificar contraseña**: debe usar anon key con `persistSession:false`/`autoRefreshToken:false` para no tocar las cookies de la sesión activa.
- **Migración**: aplicar y verificar con el rigor del gotcha del proyecto antes de mergear.
- **Sin tarjeta/Stripe portal**: la ficha de suscripción no expone gestión de pago; si el cliente quiere cambiar tarjeta, hoy es vía contacto (fuera de alcance).
```
