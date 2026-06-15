# Fase 6 · Sub-bloque C+D — Pulido de auditoría & Limpieza de tipos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 8 hallazgos BAJOS de la auditoría de Fase 6 y saldar la deuda de tipos (85 `as any`/`as unknown as`), sin cambiar comportamiento visible salvo la validación server-side de onboarding (INP-4) y progreso (EDGE-5).

**Architecture:** Un solo worktree, dos fases internas secuenciales. **Fase C** = fixes de comportamiento/seguridad (con tests nuevos, TDD). **Fase D** = completar a mano `lib/supabase/types.ts` (es bespoke, no autogenerado) y quitar los casts archivo por archivo con `tsc` + suite como red; sin cambios de runtime. Cada tarea termina en commit. Gate por fase: vitest verde + `tsc` limpio + `next build` verde.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Stripe, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-fase6-cd-pulido-limpieza-design.md`
**Auditoría origen:** `docs/superpowers/audits/2026-06-11-fase6-seguridad-hallazgos.md`

**Convenciones del repo verificadas:**
- Tests viven en `__tests__/*.test.ts` (NO co-localizados). Comando: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`. Baseline **216**.
- Patrón de mock de Supabase para server-actions: ver `__tests__/day-clone.test.ts` (fake `supabase` + `vi.mock("@/lib/admin/auth")` + `vi.mock("next/cache")`).
- Patrón de errores genéricos: `lib/portal/settingsActions.ts` (`GENERIC_ERROR` + `console.error("[fn]", error)` + `return { ok:false, error: GENERIC_ERROR }`).
- `requireAdmin()` vive en `lib/admin/auth.ts` y devuelve `{ ok, supabase, user }`.
- Estados que conceden acceso: `ACCESS_STATES` en `lib/content/subscription-access.ts` (`["active","trialing","past_due"]`).
- Helpers de fecha compartidos: `lib/admin/date-helpers.ts` (`monthKey`, `monthLabel`, `dayLabel`).

---

## FASE C — 8 fixes de auditoría

---

### Task C1: STG-2 — bajar expiración de signed URLs a 600s (vía constante compartida)

**Files:**
- Create: `lib/storage/signed-url.ts`
- Create test: `__tests__/signed-url.test.ts`
- Modify: `lib/admin/clients-queries.ts:183` (usa `createSignedUrl(p.storage_path, 3600)`)
- Modify: `app/portal/history/page.tsx:38` (usa `createSignedUrl(p.storage_path, 3600)`)

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/signed-url.test.ts
import { describe, it, expect } from "vitest";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signed-url";

describe("SIGNED_URL_TTL_SECONDS", () => {
  it("is 600 seconds (10 min) for body photos", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/signed-url.test.ts`
Expected: FAIL — cannot resolve `@/lib/storage/signed-url`.

- [ ] **Step 3: Create the constant module**

```ts
// lib/storage/signed-url.ts
// TTL de las URLs firmadas de fotos de progreso. Bajado de 3600 → 600 (STG-2):
// las URLs quedan en el payload RSC/HTML; 10 min reduce la ventana de intercepción.
export const SIGNED_URL_TTL_SECONDS = 600;
```

- [ ] **Step 4: Use the constant in both call sites**

En `lib/admin/clients-queries.ts`: añade el import al inicio del archivo
```ts
import { SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signed-url";
```
y cambia la llamada (línea ~183):
```ts
const { data: signed } = await service.storage.from("progress").createSignedUrl(p.storage_path, SIGNED_URL_TTL_SECONDS);
```

En `app/portal/history/page.tsx`: añade el import al inicio
```ts
import { SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signed-url";
```
y cambia la llamada (línea ~38):
```ts
      .createSignedUrl(p.storage_path, SIGNED_URL_TTL_SECONDS);
```

- [ ] **Step 5: Run test + tsc to verify pass**

Run: `npx vitest run __tests__/signed-url.test.ts && npx tsc --noEmit`
Expected: test PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/storage/signed-url.ts __tests__/signed-url.test.ts lib/admin/clients-queries.ts app/portal/history/page.tsx
git commit -m "fix(stg-2): expiración de signed URLs de fotos a 600s vía constante compartida"
```

---

### Task C2: INP-5 — tope de longitud en subject/body de `sendMessage`

**Files:**
- Modify: `lib/admin/message-helpers.ts` (añadir validador puro)
- Modify: `lib/admin/messageActions.ts:43-45` (usar el validador)
- Modify test: `__tests__/message-helpers.test.ts` (añadir casos)

Límites confirmados: **subject ≤ 200**, **body ≤ 5000** caracteres.

- [ ] **Step 1: Write the failing test**

Añade a `__tests__/message-helpers.test.ts` (importa el nuevo símbolo en el `import` existente del archivo o añade uno):

```ts
import { validateMessageContent } from "@/lib/admin/message-helpers";

describe("validateMessageContent", () => {
  it("rechaza subject/body vacíos", () => {
    expect(validateMessageContent("", "hola").ok).toBe(false);
    expect(validateMessageContent("hola", "   ").ok).toBe(false);
  });
  it("rechaza subject > 200 chars", () => {
    expect(validateMessageContent("a".repeat(201), "ok").ok).toBe(false);
  });
  it("rechaza body > 5000 chars", () => {
    expect(validateMessageContent("ok", "a".repeat(5001)).ok).toBe(false);
  });
  it("acepta dentro de límites", () => {
    expect(validateMessageContent("Asunto", "Mensaje").ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/message-helpers.test.ts`
Expected: FAIL — `validateMessageContent` no existe.

- [ ] **Step 3: Add the validator to `lib/admin/message-helpers.ts`**

```ts
export const MESSAGE_SUBJECT_MAX = 200;
export const MESSAGE_BODY_MAX = 5000;

export function validateMessageContent(
  subject: string,
  body: string
): { ok: true } | { ok: false; error: string } {
  if (!subject.trim() || !body.trim()) {
    return { ok: false, error: "Asunto y mensaje son obligatorios" };
  }
  if (subject.trim().length > MESSAGE_SUBJECT_MAX) {
    return { ok: false, error: `El asunto no puede exceder ${MESSAGE_SUBJECT_MAX} caracteres` };
  }
  if (body.trim().length > MESSAGE_BODY_MAX) {
    return { ok: false, error: `El mensaje no puede exceder ${MESSAGE_BODY_MAX} caracteres` };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Wire it into `sendMessage`**

En `lib/admin/messageActions.ts`, importa el validador y reemplaza el bloque de validación actual (líneas ~43-45):

```ts
import { expandRecipients, validateMessageContent, type RecipientSelection } from "./message-helpers";
```
```ts
  const contentCheck = validateMessageContent(input.subject, input.body);
  if (!contentCheck.ok) return { ok: false, error: contentCheck.error };
```

- [ ] **Step 5: Run tests + tsc**

Run: `npx vitest run __tests__/message-helpers.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/message-helpers.ts lib/admin/messageActions.ts __tests__/message-helpers.test.ts
git commit -m "fix(inp-5): tope de longitud en subject(200)/body(5000) de sendMessage"
```

---

### Task C3: EDGE-3 — `toDayOfWeek` usa `getUTCDay()` para alinearse con el cómputo UTC

**Files:**
- Modify: `lib/content/access.ts:42`
- Modify test: `__tests__/content-access.test.ts` (añadir caso UTC)

> **Nota de TDD (zona horaria):** en un runner UTC `getDay()` y `getUTCDay()` coinciden, así que un test "fail-first" estricto no es posible sin manipular `TZ`. El test añadido **fija la semántica UTC** (regresión) y documenta la intención; la verificación real es por inspección + suite existente verde. No te bloquees intentando hacerlo fallar en UTC.

- [ ] **Step 1: Add a UTC-semantics regression test**

Añade dentro del `describe("toDayOfWeek", ...)` en `__tests__/content-access.test.ts`:

```ts
  it("usa UTC: 2026-06-08T02:00:00Z (madrugada) sigue siendo lunes", () => {
    const d = new Date("2026-06-08T02:00:00Z"); // lunes en UTC
    expect(toDayOfWeek(d)).toBe("lunes");
  });

  it("usa UTC: instante con offset que cae en lunes UTC", () => {
    // 2026-06-07T20:00:00-06:00 === 2026-06-08T02:00:00Z (lunes UTC)
    const d = new Date("2026-06-07T20:00:00-06:00");
    expect(toDayOfWeek(d)).toBe("lunes");
  });
```

- [ ] **Step 2: Run test (passes today in UTC runner, pins intent)**

Run: `npx vitest run __tests__/content-access.test.ts`
Expected: PASS (en UTC). Documenta la semántica.

- [ ] **Step 3: Apply the fix**

En `lib/content/access.ts`, cambia el comentario y la función:

```ts
// JS getUTCDay() → DayOfWeek (0=domingo, 1=lunes, …). UTC para alinearse con
// getCurrentDayKey, que computa la semana con Date.UTC (EDGE-3).
const JS_DAY_TO_DOW: DayOfWeek[] = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

export function toDayOfWeek(date: Date): DayOfWeek {
  return JS_DAY_TO_DOW[date.getUTCDay()];
}
```

- [ ] **Step 4: Run full content-access tests + tsc**

Run: `npx vitest run __tests__/content-access.test.ts && npx tsc --noEmit`
Expected: PASS (todos los casos existentes siguen verdes), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/content/access.ts __tests__/content-access.test.ts
git commit -m "fix(edge-3): toDayOfWeek usa getUTCDay para alinear día y semana en UTC"
```

---

### Task C4: MW-3 — excluir `api/webhooks` y `api/cron` del matcher del middleware

**Files:**
- Modify: `middleware.ts:91-95` (el `config.matcher`)
- Create test: `__tests__/middleware-matcher.test.ts`

> El `matcher` de Next es un string regex en `config`. Lo probamos replicando el regex en un test puro (no importa internals de Next).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/middleware-matcher.test.ts
import { describe, it, expect } from "vitest";
import { MIDDLEWARE_MATCHER } from "@/middleware";

// Construye el RegExp a partir del patrón del matcher para probar cobertura.
function matches(pathname: string): boolean {
  const pattern = MIDDLEWARE_MATCHER[0]
    .replace(/^\//, "^/")        // ancla inicio
    .concat("$");                // ancla fin (el matcher de Next es full-path)
  return new RegExp(pattern).test(pathname);
}

describe("middleware matcher", () => {
  it("cubre rutas de portal", () => {
    expect(matches("/portal/today")).toBe(true);
  });
  it("cubre rutas de admin", () => {
    expect(matches("/admin/dashboard")).toBe(true);
  });
  it("excluye api/webhooks (Stripe, máquina-a-máquina)", () => {
    expect(matches("/api/webhooks/stripe")).toBe(false);
  });
  it("excluye api/cron (Vercel Cron)", () => {
    expect(matches("/api/cron/purge-messages")).toBe(false);
  });
  it("sigue cubriendo otras rutas api (p.ej. portal/progress)", () => {
    expect(matches("/api/portal/progress")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/middleware-matcher.test.ts`
Expected: FAIL — `MIDDLEWARE_MATCHER` no se exporta (y webhook/cron aún matchean).

- [ ] **Step 3: Update `middleware.ts` to export the matcher and exclude machine routes**

Reemplaza el bloque `export const config` al final de `middleware.ts` por:

```ts
// Exportado para test de cobertura (MW-3). Excluye api/webhooks y api/cron:
// son endpoints máquina-a-máquina (Stripe / Vercel Cron) que no deben pagar
// getUser()+query a profiles ni arriesgar un redirect.
export const MIDDLEWARE_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
];

export const config = {
  matcher: MIDDLEWARE_MATCHER,
};
```

- [ ] **Step 4: Run test + tsc**

Run: `npx vitest run __tests__/middleware-matcher.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts __tests__/middleware-matcher.test.ts
git commit -m "fix(mw-3): excluye api/webhooks y api/cron del matcher del middleware"
```

---

### Task C5: EDGE-5 — derivar `subscriptionId` en el servidor (ignorar el del body)

**Files:**
- Modify: `lib/content/queries.ts` (añadir `getAccessSubscriptionId`)
- Modify: `app/api/portal/progress/route.ts` (derivar la sub; ignorar body.subscriptionId)
- Create test: `__tests__/progress-subscription.test.ts`

**Comportamiento:** la route deja de confiar en `subscriptionId` del body. Deriva la suscripción que concede acceso (`ACCESS_STATES`) del `getUser()`. Si no hay → 400.

- [ ] **Step 1: Write the failing test (helper con fake supabase)**

```ts
// __tests__/progress-subscription.test.ts
import { describe, it, expect } from "vitest";
import { pickAccessSubscriptionId } from "@/lib/content/queries";

describe("pickAccessSubscriptionId", () => {
  it("devuelve el id de la fila de sub con estado de acceso", () => {
    expect(pickAccessSubscriptionId({ id: "sub-real" })).toBe("sub-real");
  });
  it("devuelve null si no hay fila", () => {
    expect(pickAccessSubscriptionId(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/progress-subscription.test.ts`
Expected: FAIL — `pickAccessSubscriptionId` no existe.

- [ ] **Step 3: Add the helper + a server query in `lib/content/queries.ts`**

Añade al final de `lib/content/queries.ts`:

```ts
/** Decisión pura (testeable): extrae el id de la fila de sub que concede acceso. */
export function pickAccessSubscriptionId(
  row: { id: string } | null
): string | null {
  return row?.id ?? null;
}

/**
 * Deriva la suscripción que concede acceso (ACCESS_STATES) del usuario.
 * Server-side: NO se confía en ningún subscriptionId del cliente (EDGE-5).
 */
export async function getAccessSubscriptionId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("profile_id", userId)
    .in("status", ACCESS_STATES as readonly string[])
    .maybeSingle();
  return pickAccessSubscriptionId(data as { id: string } | null);
}
```

- [ ] **Step 4: Run helper test to verify pass**

Run: `npx vitest run __tests__/progress-subscription.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the route to derive server-side**

Reemplaza el cuerpo de `app/api/portal/progress/route.ts` por:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertProgressLog, getAccessSubscriptionId } from "@/lib/content/queries";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  // subscriptionId del body se IGNORA deliberadamente (EDGE-5): se deriva del server.
  const { dayId, exercisesDone, generalNotes, completed } = body as {
    dayId: string;
    exercisesDone: Record<string, unknown>;
    generalNotes: string;
    completed: boolean;
  };

  if (!dayId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const subscriptionId = await getAccessSubscriptionId(user.id);
  if (!subscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const result = await upsertProgressLog({
    userId: user.id,
    subscriptionId,
    programDayId: dayId,
    exercisesDone,
    generalNotes,
    completed,
  });

  if (!result) {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ id: result.id });
}
```

- [ ] **Step 6: Check the client caller still works**

Run: `grep -rn "api/portal/progress" components/ app/ --include="*.tsx" --include="*.ts"`
Si el cliente envía `subscriptionId` en el body, **déjalo** (ahora se ignora sin romper). No es necesario cambiar el cliente, pero anótalo para el smoke.

- [ ] **Step 7: Run full suite + tsc + build**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add lib/content/queries.ts app/api/portal/progress/route.ts __tests__/progress-subscription.test.ts
git commit -m "fix(edge-5): /api/portal/progress deriva subscriptionId del server, ignora el body"
```

---

### Task C6: INP-1 — mensajes de error genéricos (no filtrar `error.message` de Postgres)

**Files:**
- Modify: `lib/admin/dayActions.ts` (líneas 44,51,73,86,101,102,124,147 — todos los `error: error.message`/`*Err.message`)
- Modify: `lib/admin/pillarActions.ts`
- Modify: `lib/admin/onboardingActions.ts` (31,50,66,79)
- Modify: `lib/admin/messageActions.ts` (59,64,118,122)
- Modify: `app/api/admin/upload/route.ts:34`
- Modify: `app/api/admin/clients/[clientId]/route.ts:48`
- Create: `lib/admin/errors.ts` (constante + helper de log)
- Create test: `__tests__/admin-errors.test.ts`

**Patrón:** loggear el error completo server-side (`console.error("[fn]", error)`) y devolver un mensaje genérico. NO devolver `error.message`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/admin-errors.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { ADMIN_GENERIC_ERROR, logAndGeneric } from "@/lib/admin/errors";

afterEach(() => vi.restoreAllMocks());

describe("logAndGeneric", () => {
  it("loggea el error real y devuelve el mensaje genérico", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dbError = { message: "duplicate key value violates unique constraint \"x\"" };
    const result = logAndGeneric("saveDay", dbError);
    expect(result).toBe(ADMIN_GENERIC_ERROR);
    expect(spy).toHaveBeenCalledWith("[saveDay]", dbError);
  });
  it("el mensaje genérico no contiene detalles de schema", () => {
    expect(ADMIN_GENERIC_ERROR.toLowerCase()).not.toContain("constraint");
    expect(ADMIN_GENERIC_ERROR.toLowerCase()).not.toContain("column");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/admin-errors.test.ts`
Expected: FAIL — `@/lib/admin/errors` no existe.

- [ ] **Step 3: Create `lib/admin/errors.ts`**

```ts
// Mensaje genérico para acciones admin. Evita filtrar internals de Postgres/RLS
// (tablas, columnas, constraints) al cliente (INP-1). El error real va al log server-side.
export const ADMIN_GENERIC_ERROR = "No se pudo completar la operación. Intenta más tarde.";

export function logAndGeneric(context: string, error: unknown): string {
  console.error(`[${context}]`, error);
  return ADMIN_GENERIC_ERROR;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run __tests__/admin-errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace raw `error.message` returns across the admin actions/routes**

Para CADA sitio listado, importa `logAndGeneric` y sustituye el retorno crudo. Ejemplos concretos:

En `lib/admin/dayActions.ts` (añade `import { logAndGeneric } from "./errors";`) — patrón por cada ocurrencia:
```ts
// antes:  if (error) return { dayId: data.id, error: error.message };
if (error) return { dayId: data.id, error: logAndGeneric("saveDay", error) };
```
```ts
// antes:  if (error) return { dayId: "", error: error.message };
if (error) return { dayId: "", error: logAndGeneric("saveDay", error) };
```
```ts
// saveBlocks: antes  if (delError) return { error: delError.message };
if (delError) return { error: logAndGeneric("saveBlocks.delete", delError) };
// antes  if (insError) return { error: insError.message };
if (insError) return { error: logAndGeneric("saveBlocks.insert", insError) };
```
```ts
// deleteDay: antes  if (blockErr) return { error: blockErr.message };
if (blockErr) return { error: logAndGeneric("deleteDay.blocks", blockErr) };
// antes  if (error) return { error: error.message };
if (error) return { error: logAndGeneric("deleteDay", error) };
```
```ts
// cloneDay: antes  if (error) return { error: error.message };
if (error) return { error: logAndGeneric("cloneDay", error) };
```
Aplica el mismo patrón (contexto = `fnName`) a:
- `lib/admin/pillarActions.ts`: cada `return { ... error: error.message }`.
- `lib/admin/onboardingActions.ts`: líneas con `error.message` (saveQuestion update/insert, reorderQuestions, setQuestionActive).
- `lib/admin/messageActions.ts`: `msgErr.message`, `rErr.message` (sendMessage), y los dos de `deleteMessage`.
- `app/api/admin/upload/route.ts:34`: `console.error("[upload]", error)` + devolver mensaje genérico en el JSON (status conservado).
- `app/api/admin/clients/[clientId]/route.ts:48`: igual — log + mensaje genérico.

> Si algún `error.message` alimenta lógica (no se muestra al cliente), déjalo. Solo cambia los que **se devuelven al cliente**.

- [ ] **Step 6: Run full suite + tsc**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npx tsc --noEmit`
Expected: PASS (ajusta cualquier test que afirmara el mensaje crudo: debe ahora esperar `ADMIN_GENERIC_ERROR`), tsc clean.

- [ ] **Step 7: Verify no raw message leaks remain**

Run: `grep -rn "error: error.message\|error: .*Err.message\|error: .*Error.message" lib/admin/ app/api/admin/`
Expected: sin resultados (o solo los intencionales documentados).

- [ ] **Step 8: Commit**

```bash
git add lib/admin/errors.ts __tests__/admin-errors.test.ts lib/admin/ app/api/admin/
git commit -m "fix(inp-1): mensajes genéricos + log server-side en actions/rutas admin"
```

---

### Task C7: SVC-2 — `create-checkout` usa cliente RLS-aware donde es posible

**Files:**
- Modify: `app/api/subscriptions/create-checkout/route.ts`

**Comportamiento:** la verificación de sesión ya existe. Las lecturas de catálogo (`program_variants`, `program_variant_prerequisites`) son `public_read`; la lectura/escritura de `profiles` está confinada al propio usuario por RLS. Cambiar `createServiceClient()` por el `createClient()` RLS-aware (ya creado como `supabase`) en esas operaciones; eliminar el `service` si deja de usarse.

> **Riesgo:** la escritura de `stripe_customer_id` debe seguir funcionando bajo RLS de `profiles_update_own` (el `with check` ancla `role`, no bloquea `stripe_customer_id`). Verifica con `tsc` + que los tests existentes de prerequisites/checkout sigan verdes. Si alguna operación falla bajo RLS, **deja esa específica con service-role** y documenta por qué en un comentario.

- [ ] **Step 1: Baseline — run existing related tests**

Run: `npx vitest run __tests__/prerequisites.test.ts`
Expected: PASS (baseline antes de tocar).

- [ ] **Step 2: Replace `service` with `supabase` for catalog + profile ops**

En `app/api/subscriptions/create-checkout/route.ts`:
- Elimina `const service = createServiceClient();` y el import de `createServiceClient` **si ya no se usa**.
- Reemplaza cada `service.from(...)` por `supabase.from(...)` (las 4 queries: variant, prereqRows, clientSubs, profile) y la actualización de `stripe_customer_id`.

El bloque de update queda (manteniendo el cast hasta la Fase D):
```ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
```

- [ ] **Step 3: Run suite + tsc + build**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npx tsc --noEmit && npm run build`
Expected: PASS, tsc clean, build verde.

- [ ] **Step 4: Manual reasoning checkpoint**

Confirma en el diff que ninguna operación que requiera bypassear RLS quedó en `supabase`. Si todo el flujo es propio-usuario + catálogo público, está correcto.

- [ ] **Step 5: Commit**

```bash
git add app/api/subscriptions/create-checkout/route.ts
git commit -m "fix(svc-2): create-checkout usa cliente RLS-aware (reduce uso de service-role)"
```

---

### Task C8: INP-4 — guardado de onboarding vía server action con validación server-side

**Files:**
- Create: `lib/onboarding/responsesActions.ts`
- Create: `lib/onboarding/responses-validation.ts` (validador puro testeable)
- Create test: `__tests__/onboarding-responses-validation.test.ts`
- Modify: `app/onboarding/questionnaire/QuestionnaireForm.tsx` (llamar la action; quitar escritura directa a Supabase)

**Comportamiento:** la action obtiene identidad con `getUser()`, ignora cualquier `profileId` del cliente, revalida requeridas/forma contra `onboarding_questions` **activas**, hace upsert de `onboarding_responses` y marca `profiles.onboarding_completed = true` solo si pasa.

- [ ] **Step 1: Write the failing test for the pure validator**

```ts
// __tests__/onboarding-responses-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateResponses, type ActiveQuestion } from "@/lib/onboarding/responses-validation";

const QUESTIONS: ActiveQuestion[] = [
  { id: "q1", is_required: true },
  { id: "q2", is_required: false },
];

describe("validateResponses", () => {
  it("rechaza si falta una requerida", () => {
    const r = validateResponses(QUESTIONS, { q2: "algo" });
    expect(r.ok).toBe(false);
  });
  it("rechaza si la requerida está vacía", () => {
    expect(validateResponses(QUESTIONS, { q1: "" }).ok).toBe(false);
    expect(validateResponses(QUESTIONS, { q1: [] }).ok).toBe(false);
  });
  it("acepta cuando las requeridas están respondidas", () => {
    expect(validateResponses(QUESTIONS, { q1: "sí" }).ok).toBe(true);
  });
  it("ignora respuestas a preguntas inexistentes (no rompe)", () => {
    expect(validateResponses(QUESTIONS, { q1: "sí", zzz: "ruido" }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/onboarding-responses-validation.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Create the pure validator**

```ts
// lib/onboarding/responses-validation.ts
export interface ActiveQuestion {
  id: string;
  is_required: boolean;
}

export type ResponsesValidation = { ok: true } | { ok: false; error: string };

export function validateResponses(
  activeQuestions: ActiveQuestion[],
  responses: Record<string, string | string[]>
): ResponsesValidation {
  for (const q of activeQuestions) {
    if (!q.is_required) continue;
    const ans = responses[q.id];
    const empty = ans == null || ans === "" || (Array.isArray(ans) && ans.length === 0);
    if (empty) {
      return { ok: false, error: "Faltan respuestas obligatorias." };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run __tests__/onboarding-responses-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the server action**

```ts
// lib/onboarding/responsesActions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { validateResponses, type ActiveQuestion } from "./responses-validation";

const GENERIC_ERROR = "No se pudieron guardar tus respuestas. Intenta más tarde.";

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitOnboarding(
  responses: Record<string, string | string[]>
): Promise<SubmitResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  // Revalida contra las preguntas ACTIVAS (no se confía en el cliente).
  const { data: qRaw } = await supabase
    .from("onboarding_questions")
    .select("id, is_required")
    .eq("is_active", true);
  const activeQuestions = (qRaw as ActiveQuestion[] | null) ?? [];

  const check = validateResponses(activeQuestions, responses);
  if (!check.ok) return check;

  // profileId SIEMPRE = user.id (se ignora cualquier valor del cliente).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error: upsertError } = await client.from("onboarding_responses").upsert({
    profile_id: user.id,
    responses,
    completed_at: new Date().toISOString(),
  });
  if (upsertError) {
    console.error("[submitOnboarding.upsert]", upsertError);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error: updateError } = await client
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);
  if (updateError) {
    console.error("[submitOnboarding.profile]", updateError);
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true };
}
```

- [ ] **Step 6: Wire the form to the action**

En `app/onboarding/questionnaire/QuestionnaireForm.tsx`:
- Quita `import { createClient } from "@/lib/supabase/client";`.
- Añade `import { submitOnboarding } from "@/lib/onboarding/responsesActions";`.
- El prop `profileId` deja de usarse para escribir (ya no se envía al server). Puedes mantenerlo en la firma para no tocar el padre, pero **no lo pases a la action**. Reemplaza el bloque `setLoading(true)` … `router.push` por:

```ts
    setLoading(true);
    const result = await submitOnboarding(answers);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/portal/today");
    router.refresh();
```

> La validación client-side de requeridas (líneas 44-53) se mantiene como UX (feedback inmediato); la server action es la barrera real.

- [ ] **Step 7: Run suite + tsc + build**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npx tsc --noEmit && npm run build`
Expected: PASS, tsc clean, build verde.

- [ ] **Step 8: Commit**

```bash
git add lib/onboarding/ __tests__/onboarding-responses-validation.test.ts app/onboarding/questionnaire/QuestionnaireForm.tsx
git commit -m "fix(inp-4): onboarding se guarda vía server action con validación server-side"
```

---

### Gate de fin de Fase C

- [ ] **Run full gate**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npx tsc --noEmit && npm run build`
Expected: suite verde (≥ baseline + nuevos tests), tsc clean, build verde.

---

## FASE D — Limpieza de tipos y deuda arrastrada (sin cambio de comportamiento)

---

### Task D1: Tests de `cloneDay`/`cloneWeek` (cobertura faltante)

**Files:**
- Modify: `__tests__/day-clone.test.ts` (hoy solo cubre `deleteDay`)

> El fake supabase actual es limitado. Amplíalo para soportar las lecturas de `cloneDay` (día origen + bloques + chequeo de celda destino) y registra inserts.

- [ ] **Step 1: Extend the fake supabase + add cloneDay tests**

Reemplaza el contenido de `__tests__/day-clone.test.ts` por una versión que cubra `cloneDay` y `cloneWeek`:

```ts
// __tests__/day-clone.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Tables {
  program_days: Record<string, unknown>[];
  program_day_blocks: Record<string, unknown>[];
}
let db: Tables;
const inserts: { table: string; payload: unknown }[] = [];

function makeClient() {
  return {
    from: (table: keyof Tables) => ({
      select: () => ({
        eq: (col: string, val: unknown) => ({
          eq: (col2: string, val2: unknown) => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
            maybeSingle: () => Promise.resolve({
              data: (db[table] as Record<string, unknown>[]).find(
                (r) => r[col] === val && r[col2] === val2
              ) ?? null,
            }),
            order: () => Promise.resolve({ data: db[table] }),
            single: () => Promise.resolve({
              data: (db[table] as Record<string, unknown>[])[0] ?? null,
            }),
          }),
          order: () => Promise.resolve({ data: db[table] }),
          single: () => Promise.resolve({
            data: (db[table] as Record<string, unknown>[])[0] ?? null,
          }),
        }),
      }),
      insert: (payload: unknown) => {
        inserts.push({ table, payload });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-day" }, error: null }) }) };
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  };
}

const fakeSupabase = makeClient();
vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn(async () => ({ ok: true, supabase: fakeSupabase, user: { id: "admin1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteDay, cloneDay, cloneWeek } from "@/lib/admin/dayActions";

beforeEach(() => {
  db = { program_days: [], program_day_blocks: [] };
  inserts.length = 0;
});

describe("deleteDay", () => {
  it("deletes blocks then the day without error", async () => {
    const res = await deleteDay("d1");
    expect(res.error).toBeUndefined();
  });
});

describe("cloneDay", () => {
  it("returns error when source day not found", async () => {
    db.program_days = [];
    const res = await cloneDay("missing", { seriesId: "s1", weekNumber: 2, dayOfWeek: "lunes" }, false);
    expect(res.error).toBe("Día origen no encontrado");
  });

  it("clones source day into empty target cell", async () => {
    db.program_days = [
      { id: "src", week_number: 1, day_of_week: "lunes", workout_focus: "f",
        title: "T", description: "d", day_type: "workout", duration_minutes: 30, published: true },
    ];
    const res = await cloneDay("src", { seriesId: "s1", weekNumber: 2, dayOfWeek: "lunes" }, false);
    expect(res.error).toBeUndefined();
    expect(res.dayId).toBe("new-day");
    expect(inserts.some((i) => i.table === "program_days")).toBe(true);
  });
});

describe("cloneWeek", () => {
  it("returns error when source week has no days", async () => {
    db.program_days = [];
    const res = await cloneWeek("s1", 1, 2, false);
    expect(res.error).toBe("La semana origen no tiene días");
  });
});
```

> **Nota:** el fake es aproximado al encadenamiento real de queries de `cloneDay`. Si algún test no refleja el flujo exacto, ajústalo a las llamadas reales (lee `lib/admin/dayActions.ts`), preservando la intención: source-not-found, clonado feliz, week-sin-días.

- [ ] **Step 2: Run the test**

Run: `npx vitest run __tests__/day-clone.test.ts`
Expected: PASS (ajusta el fake si algún encadenamiento difiere).

- [ ] **Step 3: Commit**

```bash
git add __tests__/day-clone.test.ts
git commit -m "test(d1): cobertura de cloneDay/cloneWeek"
```

---

### Task D2: `try/catch` alrededor de `stripe.subscriptions.retrieve`

**Files:**
- Modify: `lib/webhooks/stripe-handlers.ts` (la llamada a `stripe.subscriptions.retrieve`)

- [ ] **Step 1: Locate the call**

Run: `grep -n "subscriptions.retrieve" lib/webhooks/stripe-handlers.ts`
Lee el contexto (±15 líneas) para ver qué se hace con el resultado.

- [ ] **Step 2: Wrap in try/catch**

Envuelve la llamada de forma que un fallo de red/Stripe no tumbe el handler del webhook; loggea y maneja con el mismo flujo de error existente del handler (p.ej. retornar/early-return como ya hacen otras ramas). Ejemplo de forma:

```ts
let subscription;
try {
  subscription = await stripe.subscriptions.retrieve(subscriptionId);
} catch (err) {
  console.error("[stripe-handlers] subscriptions.retrieve failed", err);
  return; // el webhook responde 200; Stripe reintenta el evento si aplica
}
```

> Ajusta el `return`/manejo a la firma real de la función (lee el handler). No cambies el comportamiento del happy-path.

- [ ] **Step 3: Run webhook tests + tsc**

Run: `npx vitest run __tests__/webhooks.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add lib/webhooks/stripe-handlers.ts
git commit -m "fix(d2): try/catch en stripe.subscriptions.retrieve"
```

---

### Task D3: Unificar `formatDate` en `lib/admin/date-helpers.ts` (preservando cada formato)

**Files:**
- Modify: `lib/admin/date-helpers.ts` (añadir `weekdayLabel`, `longDateLabel`)
- Modify test: `__tests__/date-helpers.test.ts` (fijar outputs exactos)
- Modify: `app/portal/pilares/page.tsx`, `components/portal/TodayView.tsx`, `components/portal/settings/SubscriptionCard.tsx`, `components/portal/settings/PaymentHistory.tsx`

> **CRÍTICO:** son **3 formatos distintos**. No los colapses a uno. Mapeo:
> - `weekdayLabel(iso?)` — "weekday, día de mes" (sin año), capitaliza. Usado por `pilares` y `TodayView` (este con default a hoy si `iso` es undefined).
> - `longDateLabel(iso)` — "día de mes largo de año". Usado por `SubscriptionCard`.
> - `PaymentHistory` usa el formato "día mes-corto año" → ya existe `dayLabel`. Reúsalo.

- [ ] **Step 1: Write failing tests pinning exact output**

Añade a `__tests__/date-helpers.test.ts`:

```ts
import { weekdayLabel, longDateLabel, dayLabel } from "@/lib/admin/date-helpers";

describe("weekdayLabel", () => {
  it("formatea weekday + día + mes, capitalizado, sin año", () => {
    expect(weekdayLabel("2026-06-08")).toBe("Lunes, 8 de junio");
  });
  it("default a hoy cuando no recibe iso (no truena)", () => {
    expect(typeof weekdayLabel()).toBe("string");
  });
});

describe("longDateLabel", () => {
  it("formatea día + mes largo + año", () => {
    expect(longDateLabel("2026-06-08")).toBe("8 de junio de 2026");
  });
  it("tolera iso con tiempo (toma la parte de fecha)", () => {
    expect(longDateLabel("2026-06-08T00:00:00Z")).toBe("8 de junio de 2026");
  });
});
```

> Verifica los strings esperados ejecutando en node la salida actual de cada `formatDate` con `2026-06-08` ANTES de fijarlos, por si el locale del runner difiere. Si difiere, ajusta el expected al output real (el objetivo es **no cambiar** lo que ve el usuario).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/date-helpers.test.ts`
Expected: FAIL — `weekdayLabel`/`longDateLabel` no existen.

- [ ] **Step 3: Add the helpers to `lib/admin/date-helpers.ts`**

```ts
export function weekdayLabel(iso?: string): string {
  const date = iso ? new Date(`${iso.split("T")[0]}T12:00:00`) : new Date();
  const s = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function longDateLabel(iso: string): string {
  return new Date(`${iso.split("T")[0]}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run __tests__/date-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace local copies**

- `app/portal/pilares/page.tsx`: borra el `function formatDate` local; importa `weekdayLabel` y usa `weekdayLabel(isoToday)`.
- `components/portal/TodayView.tsx`: borra el `function formatDate` local; importa `weekdayLabel` y usa `weekdayLabel(content?.effectiveDate)`.
- `components/portal/settings/SubscriptionCard.tsx`: borra el local; importa `longDateLabel` y reemplaza llamadas `formatDate(...)` por `longDateLabel(...)`.
- `components/portal/settings/PaymentHistory.tsx`: borra el local; importa `dayLabel` y reemplaza `formatDate(inv.invoice_date)` por `dayLabel(inv.invoice_date)`.

> Si `inv.invoice_date` viene con tiempo (ISO completo), `dayLabel` hace `${iso}T12:00:00` → inválido. En ese caso usa `dayLabel(inv.invoice_date.split("T")[0])` o ajusta `dayLabel` para tolerar tiempo igual que `longDateLabel` (preferible: normaliza en `dayLabel` con `.split("T")[0]` y añade un test). Verifica el shape real del dato.

- [ ] **Step 6: Run suite + tsc + build**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npx tsc --noEmit && npm run build`
Expected: PASS, tsc clean, build verde.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/date-helpers.ts __tests__/date-helpers.test.ts app/portal/pilares/page.tsx components/portal/TodayView.tsx components/portal/settings/SubscriptionCard.tsx components/portal/settings/PaymentHistory.tsx
git commit -m "refactor(d3): unifica formatDate en date-helpers (weekdayLabel/longDateLabel/dayLabel)"
```

---

### Task D4: Auditar y completar `lib/supabase/types.ts` a mano

**Files:**
- Modify: `lib/supabase/types.ts`

**Objetivo:** que el tipo `Database` refleje las migraciones 001–010, para que los casts `as any`/`as unknown as` puedan quitarse en D5 sin que `tsc` falle.

- [ ] **Step 1: Inventariar el schema real vs el tipo actual**

Run: `ls supabase/migrations/` y revisa, por cada tabla usada con cast, sus columnas reales. Compara con lo declarado en `lib/supabase/types.ts`. Candidatos probables de desfase (añadidos en migr. 005–010): `progress_photos` (bucket/storage_path/taken_at/caption), `profiles.phone`, `profiles.stripe_customer_id`, campos de `subscriptions` (`months_elapsed`, `current_period_start/end`, `enrollment_date`), `program_days`, `program_day_blocks`, `onboarding_responses`, `onboarding_questions`, `messages`/`message_recipients`, `invoices`.

- [ ] **Step 2: Completar `Row`/`Insert`/`Update` faltantes**

Para cada tabla con columnas faltantes o ausente del tipo, añade/corrige sus `Row`, `Insert`, `Update` en el formato bespoke existente (mira cómo está declarada `programs` como referencia de estilo). Preserva las uniones del encabezado (`UserRole`, `SubscriptionStatus`, `BillingModel`, `Json`).

> NO reformatees a estilo typegen ni añadas `Relationships`. Mantén el archivo legible y consistente con lo que ya hay.

- [ ] **Step 3: Verify tsc still clean (sin quitar casts aún)**

Run: `npx tsc --noEmit`
Expected: clean (añadir campos al tipo no debe romper nada; los casts siguen).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "refactor(d4): completa types.ts con columnas de migraciones 005-010"
```

---

### Task D5: Quitar los `as any`/`as unknown as`, archivo por archivo

**Files (orden por densidad — confirma con grep antes de empezar):**
`lib/admin/queries.ts` (12) · `lib/admin/clients-queries.ts` (9) · `lib/content/history.ts` (7) · `lib/content/queries.ts` (6) · `lib/admin/messageActions.ts` (6) · `lib/admin/dayActions.ts` (6) · `lib/content/pillars.ts` (5) · `lib/admin/finance-queries.ts` (4) · `lib/portal/account-queries.ts` (3) · `lib/admin/onboardingActions.ts` (3) · `app/api/admin/clients/[clientId]/route.ts` (3) · `app/api/admin/clients/[clientId]/photos/[photoId]/route.ts` (3) · `lib/content/messages.ts` (2) · `lib/admin/pillarActions.ts` (2) · `app/api/subscriptions/create-checkout/route.ts` (2) · `app/api/portal/photos/[id]/route.ts` (2) · y los de 1: `lib/webhooks/stripe-handlers.ts`, `lib/portal/settingsActions.ts`, `lib/portal/messageActions.ts`, `app/portal/history/page.tsx`, `app/portal/activando/page.tsx`, `app/onboarding/questionnaire/QuestionnaireForm.tsx`, `app/api/portal/photos/route.ts`, `app/api/portal/avatar/route.ts`, `app/api/admin/upload/route.ts`, `app/admin/onboarding-settings/page.tsx`.

> **Procedimiento por archivo (repetir para cada uno):** este es un refactor mecánico gate-driven. Trabaja UN archivo a la vez.

- [ ] **Step 1: Pick the next file; read its casts**

Run (ejemplo): `grep -n "as any\|as unknown as" lib/admin/queries.ts`

- [ ] **Step 2: Replace casts with proper types**

Para cada cast:
- Si es `(supabase as any).from(...)`: quítalo; con el tipo `Database` completo, el cliente ya está tipado. Si una query con join/relationship no resuelve el tipo, usa una interfaz local `Row` + `(data as Row | null)` en el **resultado** (no en el cliente), igual que ya hace `lib/content/queries.ts` con `SubRow`/`DayRow`. Evita reintroducir `as any`.
- Si era un cast de resultado por relationships no tipadas (joins): mantén una interfaz local y castea el resultado a ella (esto es legítimo; el objetivo es eliminar `as any` y `as unknown as` hacia tipos sin forma, no prohibir tipar resultados de joins). Documenta con un comentario breve por qué el join necesita tipo local.

- [ ] **Step 3: Gate after the file**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**'`
Expected: tsc clean, suite verde. Si falla, corrige ANTES de pasar al siguiente archivo.

- [ ] **Step 4: Commit per file (o por grupo pequeño)**

```bash
git add <archivo>
git commit -m "refactor(d5): quita casts as-any en <archivo>"
```

- [ ] **Step 5: Repeat for all files in the list**

- [ ] **Step 6: Final verification — no remaining avoidable casts**

Run: `grep -rn "as any\|as unknown as" lib/ app/ --include="*.ts" --include="*.tsx" | grep -v "// keep:" | wc -l`
Expected: 0, salvo casts marcados explícitamente con un comentario `// keep:` justificado (p.ej. límites reales con SDKs externos). Lista los que queden y justifícalos.

---

### Gate de fin de Fase D

- [ ] **Run full gate**

Run: `npx vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' && npx tsc --noEmit && npm run build`
Expected: suite verde, tsc clean, build verde, working tree limpio.

---

## Cierre del sub-bloque (tras smoke del usuario)

- [ ] **Smoke manual del usuario** — enfocado en: onboarding completo (INP-4), guardado de progreso en `/portal/today` (EDGE-5). Verificar que el resto del portal/admin sigue idéntico.
- [ ] **Merge** `--no-ff` a `main` local.
- [ ] **Actualizar** `SPEC.md` (changelog), `handoff.md`, memoria `project_aura.md`, y marcar los 8 bajos como resueltos en el reporte de auditoría.
- [ ] **Registrar** para más adelante: transaccionalidad de `saveBlocks`/`savePillarBlocks` (fuera de scope, acordado).

---

## Self-Review (cobertura del spec)

- INP-1 → C6 ✓ · EDGE-5 → C5 ✓ · EDGE-3 → C3 ✓ · MW-3 → C4 ✓ · SVC-2 → C7 ✓ · STG-2 → C1 ✓ · INP-4 → C8 ✓ · INP-5 → C2 ✓
- D: regenerar/completar tipos → D4+D5 ✓ · try/catch retrieve → D2 ✓ · unificar formatDate → D3 ✓ · tests cloneDay/cloneWeek → D1 ✓
- Fuera de scope (registrado): transaccionalidad saveBlocks/savePillarBlocks ✓
- Sin migraciones nuevas (verificado: ningún fix las requiere) ✓
