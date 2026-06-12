# Spec — Fase 6 · B1: Logout en UI (admin + settings mínimo del portal)

**Fecha:** 11 de junio de 2026
**Fase:** 6 (Launch) · Sub-bloque B1
**Origen:** Hallazgos del smoke (gaps G1/G2): no hay "Cerrar sesión" ni en admin ni en el portal.

---

## Objetivo
Dar a admin y cliente una forma de **cerrar sesión** desde la UI, reutilizando el `LogoutButton` existente. Para el cliente, el logout vive en `/portal/settings` (la pestaña "Configuración" del `PortalNav` ya enlaza ahí pero la página no existe → hoy 404); este sub-bloque crea un **settings mínimo** (datos de cuenta de solo lectura + logout). La edición de datos se difiere a B2.

## Contexto verificado
- `components/auth/LogoutButton.tsx` ya existe y funciona: `supabase.auth.signOut()` → `router.push("/auth/login")` + `router.refresh()`. (`"use client"`, usa `Button variant="outline" w-full`.)
- Hoy se usa solo en `app/portal/page.tsx` (página legacy huérfana, no enlazada en el nav) y `app/portal/sin-suscripcion/page.tsx`.
- `components/portal/PortalNav.tsx` ya tiene la pestaña "Configuración" → `/portal/settings` (404 hoy).
- `app/admin/layout.tsx` (`"use client"`) tiene en el footer del sidebar un link `← Ver portal de cliente` que, además de no aportar, está **roto**: un admin que va a `/portal/*` es redirigido a `/admin/dashboard` por el middleware (separación de roles). Se elimina.

## Unidades

### Unidad 1 — Admin: logout en el sidebar
- En `app/admin/layout.tsx`, en el bloque footer del `<aside>`:
  - **Eliminar** el link `← Ver portal de cliente` (`<Link href="/portal/today">…`).
  - **Agregar** `<LogoutButton />` en su lugar.
- Importar `LogoutButton` desde `@/components/auth/LogoutButton`.
- El componente ya redirige a `/auth/login`. Sin lógica nueva.

### Unidad 2 — Portal: `/portal/settings` mínimo
- Crear `app/portal/settings/page.tsx` (Server Component). Hereda el portal layout (`PortalNav` + banner de pago pendiente).
- Contenido:
  - Título "Configuración".
  - **Datos de cuenta de solo lectura**: nombre (`full_name`), email, teléfono (`phone`) — leídos de `profiles` del usuario autenticado (`getUser()` + select por `id`). Si algún campo es null, mostrar un guion o "—".
  - `<LogoutButton />`.
- La pestaña "Configuración" del `PortalNav` (`pathname === "/portal/settings"`) queda activa y funcional; no se toca el `PortalNav`.
- Estilo: tarjeta blanca con `box-shadow: var(--shadow-card)` y tipografía del portal (Hind/Oswald), coherente con las demás vistas del portal.

## Fuera de alcance
- **Edición** de datos de cuenta (nombre/teléfono/contraseña/email) → **B2**.
- La página legacy `app/portal/page.tsx` no se toca (no enlazada; harmless).
- No se cambia el `PortalNav` ni el flujo de auth/logout (se reutiliza tal cual).

## Manejo de errores
- Logout: el flujo existente de `LogoutButton` (si `signOut` falla, el usuario permanece; el redirect siempre se intenta). Sin cambios.
- Settings: si no hay sesión, el middleware ya protege `/portal/*` (redirige a login). La query de `profiles` por RLS solo devuelve la fila propia.

## Testing
UI sin lógica pura nueva → no se agregan tests unitarios. Verificación:
- `npx tsc --noEmit` limpio y `npm run build` verde.
- **Smoke manual:** (a) logout desde el sidebar admin → va a `/auth/login`; (b) pestaña "Configuración" del portal abre `/portal/settings` (ya no 404), muestra nombre/email/teléfono y el botón; (c) logout desde settings → `/auth/login`; (d) el link "← Ver portal de cliente" ya no aparece en el admin.

## Criterio de completitud
- Admin: logout visible en el sidebar; link "Ver portal de cliente" eliminado.
- Portal: `/portal/settings` renderiza datos de cuenta + logout; la pestaña deja de ser 404.
- tsc/build verdes; smoke OK.
