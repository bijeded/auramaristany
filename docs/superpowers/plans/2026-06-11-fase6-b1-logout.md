# B1 — Logout en UI (admin + settings mínimo) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar logout en el sidebar admin y un `/portal/settings` mínimo (datos de cuenta + logout) reutilizando el `LogoutButton` existente.

**Architecture:** UI-only. Se reusa `components/auth/LogoutButton.tsx` (client, `supabase.auth.signOut()` → `/auth/login`). Admin: editar el footer del sidebar. Portal: nueva página Server Component que lee `profiles` del usuario y muestra datos + logout. Sin lógica pura nueva → verificación por tsc/build + smoke.

**Tech Stack:** Next.js 14 App Router, Supabase (server client), TypeScript.

**Spec:** docs/superpowers/specs/2026-06-11-fase6-b1-logout-design.md

---

## Notas de ejecución
- **Worktree** (modifica código). Repo sin remoto: `git config worktree.baseRef head` antes de `EnterWorktree`. Copiar `.env.local` + symlinkear `node_modules` al del repo principal (o el build/test falla): `ln -s <repo>/node_modules node_modules`.
- Sin tests unitarios nuevos (UI). Gate: `npx tsc --noEmit` + `npm run build`. Suite existente debe seguir verde (197).

---

### Task 1: Admin — logout en el sidebar (quitar "Ver portal de cliente")

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Importar LogoutButton**

En `app/admin/layout.tsx`, junto a los imports existentes (`Link`, `usePathname`, iconos de lucide), añadir:
```tsx
import { LogoutButton } from "@/components/auth/LogoutButton";
```

- [ ] **Step 2: Reemplazar el footer del sidebar**

Buscar el bloque footer actual:
```tsx
        {/* Footer */}
        <div
          className="px-6 py-4"
          style={{ borderTop: "1px solid var(--gris-linea)" }}
        >
          <Link
            href="/portal/today"
            className="font-body"
            style={{ fontSize: 12, color: "var(--gris-suave)", textDecoration: "none" }}
          >
            ← Ver portal de cliente
          </Link>
        </div>
```
Reemplazarlo por (elimina el link roto, pone el logout):
```tsx
        {/* Footer */}
        <div
          className="px-3 py-4"
          style={{ borderTop: "1px solid var(--gris-linea)" }}
        >
          <LogoutButton />
        </div>
```
(El padding pasa de `px-6` a `px-3` para alinear el botón `w-full` con el padding de la nav.)

- [ ] **Step 3: Verificar tipos + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc limpio; build verde. (`.env.local` debe estar en el worktree.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(b1): logout en sidebar admin; quita link 'Ver portal de cliente' (G1)"
```

---

### Task 2: Portal — `/portal/settings` mínimo (datos de cuenta + logout)

**Files:**
- Create: `app/portal/settings/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/portal/settings/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function PortalSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as { full_name?: string | null; email?: string | null; phone?: string | null };
  const rows: { label: string; value: string }[] = [
    { label: "Nombre", value: p.full_name || "—" },
    { label: "Correo", value: p.email || user.email || "—" },
    { label: "Teléfono", value: p.phone || "—" },
  ];

  return (
    <div className="p-5">
      <h1 className="font-head text-xl mb-5" style={{ color: "var(--negro)" }}>
        Configuración
      </h1>

      <div className="rounded-xl bg-white p-5 mb-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h2 className="font-head text-sm uppercase tracking-wider mb-4" style={{ color: "var(--gris-suave)" }}>
          Tu cuenta
        </h2>
        <dl className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4">
              <dt className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>
                {r.label}
              </dt>
              <dd className="font-body text-sm font-medium text-right" style={{ color: "var(--negro)" }}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <LogoutButton />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc limpio; build verde. La ruta `/portal/settings` debe aparecer en el output del build.

- [ ] **Step 3: Verificar suite existente (no regresiones)**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: 197 tests verde (no se agregan ni quitan).

- [ ] **Step 4: Commit**

```bash
git add app/portal/settings/page.tsx
git commit -m "feat(b1): /portal/settings mínimo (datos de cuenta + logout) (G2)"
```

---

## Self-Review (writing-plans)

- **Cobertura del spec:** Unidad 1 (admin logout + quitar link) → Task 1. Unidad 2 (`/portal/settings` mínimo con datos + logout) → Task 2. Criterio de completitud (tsc/build verdes, pestaña deja de ser 404) → pasos de verificación. ✓
- **Placeholder scan:** sin TBD/TODO; el `—` y el `||` son fallback reales para campos null (no placeholders). Código completo en cada paso. ✓
- **Consistencia:** `LogoutButton` importado de `@/components/auth/LogoutButton` en ambas tareas; props/campos (`full_name`/`email`/`phone`) coinciden con las columnas reales de `profiles`. ✓
- **Fuera de alcance respetado:** no se toca `PortalNav` (ya enlaza a /portal/settings), ni `app/portal/page.tsx`, ni se agrega edición (B2). ✓
