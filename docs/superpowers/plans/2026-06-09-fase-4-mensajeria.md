# Fase 4 — Mensajería + Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mensajería unidireccional Aura→clientas (in-app, individual + broadcast), infra de email (Resend + React Email) con email de mensaje nuevo + emails de ciclo de vida en webhooks de Stripe, y enlaces a WhatsApp (portal→Aura, admin→clienta).

**Architecture:** Modelo *snapshot*: al enviar se expanden las destinatarias activas a N filas en `message_recipients`. Las funciones puras (expansión, agregados, formato, teléfono) viven en `lib/admin/message-helpers.ts` y se prueban con TDD; las queries server-only y server actions las orquestan. El email se centraliza en `lib/email/` (no-op si falta API key; best-effort, nunca rompe el flujo). La UI sigue los prototipos `admin-messages.jsx` / `client-messages.jsx`.

**Tech Stack:** Next.js 14 (App Router, RSC + server actions), Supabase (RLS, admin-context client), Resend + `@react-email/components`, vitest (jsdom), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-09-fase-4-mensajeria-design.md`

---

## Convenciones del proyecto (leer antes de empezar)
- Tests en `__tests__/*.test.ts`, corridos con `npm run test:run`. `server-only` está aliaseado a vacío en `vitest.config.ts`, así que los módulos `import "server-only"` se pueden importar en tests siempre que no toquen red/DB en import.
- Server actions: archivo con `"use server"` arriba (ver `lib/admin/dayActions.ts`). Queries server-only: `import "server-only"` + `createClient` (ver `lib/content/history.ts`).
- Acceso admin a DB: `createClient()` (RLS) funciona para admin porque las policies usan `is_admin()`. Se añade un guard explícito de rol para errores limpios.
- Escrituras Supabase usan el patrón `(supabase as any).from(...)` por los tipos generados desactualizados (mismo patrón que `dayActions.ts`). No es ideal, pero es la convención vigente; regenerar `types.ts` es follow-up fuera de esta fase.
- ⚠ **tsconfig sin `target` explícito (target bajo):** NO usar spread de iteradores de `Map`/`Set` (`[...map.entries()]`, `[...new Set(x)]`, `[...map.values()]`) — produce error TS2802. Usar `Array.from(...)` en su lugar. (Spread de arrays normales sí es válido.)
- Estilo UI: inline styles + clases utilitarias + CSS custom properties de marca (`var(--lavanda)`, `var(--rosa-soft)`, `var(--gris-linea)`, etc.), como en `components/portal/PortalNav.tsx`.

---

## File Structure

**Nuevos:**
- `supabase/migrations/006_messaging.sql` — RLS SELECT de `messages` para clientas, UPDATE de `read_at` por la dueña, índices.
- `lib/admin/message-helpers.ts` — funciones puras (expansión, grupos, formato, teléfono).
- `lib/email/client.ts` — cliente Resend (no-op sin key).
- `lib/email/templates/Layout.tsx` — envoltorio de marca para emails.
- `lib/email/templates/NewMessageEmail.tsx`, `WelcomeEmail.tsx`, `PaymentFailedEmail.tsx`, `SubscriptionEndedEmail.tsx`.
- `lib/email/send.ts` — helpers best-effort + batch.
- `lib/content/messages.ts` — queries del portal (inbox, detalle, no-leídos).
- `lib/portal/messageActions.ts` — server action `markMessageRead`.
- `lib/admin/messageActions.ts` — server action `sendMessage`.
- `components/admin/MessagesAdmin.tsx` — composer + lista de enviados (client).
- `components/portal/MessagesList.tsx` — lista del portal (client, recibe datos del server).
- `app/portal/messages/[id]/page.tsx` — detalle read-only.
- Tests: `__tests__/message-helpers.test.ts`, `__tests__/email-send.test.ts`.

**Modificados:**
- `lib/admin/queries.ts` — `getActiveSubscriberRows`, `getSentMessages`.
- `app/admin/messages/page.tsx` — reemplaza stub.
- `app/portal/messages/page.tsx` — reemplaza stub.
- `app/portal/layout.tsx` — pasa `unreadMessages` a `PortalNav`.
- `components/portal/PortalNav.tsx` — badge de no-leídos.
- `lib/webhooks/stripe-handlers.ts` — 3 emails de ciclo de vida best-effort.
- `.env.local` (manual) — `NEXT_PUBLIC_AURA_WHATSAPP`.

---

## Task 1: Migración 006 (RLS + índices)

**Files:**
- Create: `supabase/migrations/006_messaging.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 006_messaging.sql — Fase 4: Mensajería
-- Completa lo que falta en 001 para que las clientas lean sus mensajes
-- y marquen leído. El esquema base (messages, message_recipients) ya existe.

-- 1) SELECT de messages para la destinataria (001 solo tenía messages_admin_write)
create policy "messages_select_recipient_or_admin"
  on messages for select using (
    is_admin() or exists (
      select 1 from message_recipients mr
      where mr.message_id = messages.id
        and mr.recipient_id = auth.uid()
    )
  );

-- 2) UPDATE de message_recipients por la dueña (marcar read_at sin service role)
create policy "message_recipients_own_update"
  on message_recipients for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- 3) Índices para inbox, badge y agregado "leídos de N"
create index if not exists idx_message_recipients_recipient_read
  on message_recipients (recipient_id, read_at);
create index if not exists idx_message_recipients_message
  on message_recipients (message_id);
```

- [ ] **Step 2: Aplicar la migración en Supabase**

Aplicar vía la CLI/Management API igual que se hizo con la 005 (ver handoff). Si se usa la CLI local:

Run: `npx supabase db push` (o aplicar el SQL desde el dashboard de Supabase si la CLI no está enlazada).
Expected: las dos policies y los dos índices se crean sin error. Verificar en el dashboard que `messages` ahora tiene una policy de SELECT además de la admin.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_messaging.sql
git commit -m "feat(fase-4): migración 006 — RLS de mensajería + índices"
```

---

## Task 2: Funciones puras de mensajería (TDD)

**Files:**
- Create: `lib/admin/message-helpers.ts`
- Test: `__tests__/message-helpers.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// __tests__/message-helpers.test.ts
import { describe, it, expect } from "vitest";
import {
  buildRecipientGroups,
  expandRecipients,
  formatDestination,
  formatReadCount,
  normalizeWhatsappNumber,
  whatsappUrl,
  type ActiveSubRow,
} from "@/lib/admin/message-helpers";

const rows: ActiveSubRow[] = [
  { profile_id: "p1", full_name: "Ana", email: "ana@x.com", phone: "+52 1 55 1234 5678",
    program_variant_id: "v1", variant_name: "CuarentaMás Principiante Poco Tiempo", program_id: "g1", program_name: "CuarentaMás" },
  { profile_id: "p2", full_name: "Bea", email: "bea@x.com", phone: null,
    program_variant_id: "v1", variant_name: "CuarentaMás Principiante Poco Tiempo", program_id: "g1", program_name: "CuarentaMás" },
  { profile_id: "p2", full_name: "Bea", email: "bea@x.com", phone: null,
    program_variant_id: "v2", variant_name: "Strong & Fit Intermedio", program_id: "g3", program_name: "Strong & Fit" },
];

describe("buildRecipientGroups", () => {
  it("agrupa por variante y cuenta clientas distintas", () => {
    const groups = buildRecipientGroups(rows);
    expect(groups).toEqual([
      { variantId: "v1", label: "CuarentaMás Principiante Poco Tiempo", programName: "CuarentaMás", count: 2 },
      { variantId: "v2", label: "Strong & Fit Intermedio", programName: "Strong & Fit", count: 1 },
    ]);
  });
});

describe("expandRecipients", () => {
  it("individual devuelve solo esa clienta", () => {
    expect(expandRecipients(rows, { mode: "individual", profileId: "p1" })).toEqual(["p1"]);
  });
  it("all devuelve clientas distintas (dedup)", () => {
    expect(expandRecipients(rows, { mode: "all" }).sort()).toEqual(["p1", "p2"]);
  });
  it("groups filtra por variante y dedup entre variantes", () => {
    expect(expandRecipients(rows, { mode: "groups", variantIds: ["v1"] }).sort()).toEqual(["p1", "p2"]);
    expect(expandRecipients(rows, { mode: "groups", variantIds: ["v2"] })).toEqual(["p2"]);
  });
  it("groups con varias variantes no duplica a la misma clienta", () => {
    expect(expandRecipients(rows, { mode: "groups", variantIds: ["v1", "v2"] }).sort()).toEqual(["p1", "p2"]);
  });
});

describe("formatDestination", () => {
  it("individual muestra el nombre", () => {
    expect(formatDestination(false, 1, "Ana")).toBe("Ana");
  });
  it("broadcast muestra conteo", () => {
    expect(formatDestination(true, 12, null)).toBe("Difusión · 12 clientas");
    expect(formatDestination(true, 1, null)).toBe("Difusión · 1 clienta");
  });
});

describe("formatReadCount", () => {
  it("singular y plural", () => {
    expect(formatReadCount(1, 5)).toBe("1 leído de 5");
    expect(formatReadCount(0, 5)).toBe("0 leídos de 5");
  });
});

describe("normalizeWhatsappNumber / whatsappUrl", () => {
  it("quita todo lo no numérico", () => {
    expect(normalizeWhatsappNumber("+52 1 55 1234 5678")).toBe("5215512345678");
  });
  it("rechaza números demasiado cortos o vacíos", () => {
    expect(normalizeWhatsappNumber("123")).toBeNull();
    expect(normalizeWhatsappNumber(null)).toBeNull();
  });
  it("construye el url con texto opcional", () => {
    expect(whatsappUrl("5215512345678")).toBe("https://wa.me/5215512345678");
    expect(whatsappUrl("5215512345678", "Hola")).toBe("https://wa.me/5215512345678?text=Hola");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test:run -- message-helpers`
Expected: FAIL (`Cannot find module '@/lib/admin/message-helpers'`).

- [ ] **Step 3: Implementar las funciones puras**

```typescript
// lib/admin/message-helpers.ts
export interface ActiveSubRow {
  profile_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  program_variant_id: string;
  variant_name: string;
  program_id: string;
  program_name: string;
}

export interface RecipientGroup {
  variantId: string;
  label: string;
  programName: string;
  count: number;
}

export type RecipientSelection =
  | { mode: "individual"; profileId: string }
  | { mode: "all" }
  | { mode: "groups"; variantIds: string[] };

export function buildRecipientGroups(rows: ActiveSubRow[]): RecipientGroup[] {
  const map = new Map<string, { label: string; programName: string; clients: Set<string> }>();
  for (const r of rows) {
    let entry = map.get(r.program_variant_id);
    if (!entry) {
      entry = { label: r.variant_name, programName: r.program_name, clients: new Set() };
      map.set(r.program_variant_id, entry);
    }
    entry.clients.add(r.profile_id);
  }
  return [...map.entries()]
    .map(([variantId, v]) => ({ variantId, label: v.label, programName: v.programName, count: v.clients.size }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function expandRecipients(rows: ActiveSubRow[], sel: RecipientSelection): string[] {
  let matched: string[];
  if (sel.mode === "individual") {
    matched = rows.filter((r) => r.profile_id === sel.profileId).map((r) => r.profile_id);
  } else if (sel.mode === "all") {
    matched = rows.map((r) => r.profile_id);
  } else {
    const set = new Set(sel.variantIds);
    matched = rows.filter((r) => set.has(r.program_variant_id)).map((r) => r.profile_id);
  }
  return [...new Set(matched)];
}

export function formatDestination(isBroadcast: boolean, total: number, singleName: string | null): string {
  if (!isBroadcast) return singleName ?? "—";
  return `Difusión · ${total} ${total === 1 ? "clienta" : "clientas"}`;
}

export function formatReadCount(readCount: number, total: number): string {
  return `${readCount} leído${readCount === 1 ? "" : "s"} de ${total}`;
}

export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function whatsappUrl(number: string, text?: string): string {
  const base = `https://wa.me/${number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:run -- message-helpers`
Expected: PASS (todos los `describe`).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/message-helpers.ts __tests__/message-helpers.test.ts
git commit -m "feat(fase-4): funciones puras de mensajería (expansión, grupos, formato, whatsapp)"
```

---

## Task 3: Dependencias de email + cliente Resend

**Files:**
- Modify: `package.json` (vía npm install)
- Create: `lib/email/client.ts`

- [ ] **Step 1: Instalar dependencias**

Run: `npm install resend @react-email/components @react-email/render`
Expected: se agregan a `dependencies` sin errores de peer deps.

- [ ] **Step 2: Implementar el cliente (no-op sin key)**

```typescript
// lib/email/client.ts
import "server-only";
import { Resend } from "resend";

let cached: Resend | null = null;

/** Devuelve el cliente Resend, o null si no hay API key (no-op en dev/test). */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY no configurada — email deshabilitado (no-op).");
    return null;
  }
  if (!cached) cached = new Resend(key);
  return cached;
}

/** Remitente: en dev sin dominio verificado usar onboarding@resend.dev. */
export function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.auramaristany.com";
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores (puede tardar; si `resend` exporta tipos correctamente compila).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/email/client.ts
git commit -m "feat(fase-4): instalar Resend/React Email + cliente no-op sin key"
```

---

## Task 4: Plantillas de email (React Email)

**Files:**
- Create: `lib/email/templates/Layout.tsx`
- Create: `lib/email/templates/NewMessageEmail.tsx`
- Create: `lib/email/templates/WelcomeEmail.tsx`
- Create: `lib/email/templates/PaymentFailedEmail.tsx`
- Create: `lib/email/templates/SubscriptionEndedEmail.tsx`

- [ ] **Step 1: Layout de marca**

```tsx
// lib/email/templates/Layout.tsx
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Section, Text } from "@react-email/components";

const ROSA = "#eddbd8";
const LAVANDA = "#9982f4";
const NEGRO = "#1a1a1a";

export function Layout({ heading, children, cta }: {
  heading: string;
  children: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <Html lang="es">
      <Head />
      <Body style={{ backgroundColor: ROSA, fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 16, maxWidth: 480, margin: "0 auto", padding: 32 }}>
          <Text style={{ color: LAVANDA, fontWeight: 700, letterSpacing: 2, fontSize: 14, margin: 0 }}>AURA MARISTANY</Text>
          <Heading style={{ color: NEGRO, fontSize: 22, marginTop: 16 }}>{heading}</Heading>
          <Section style={{ color: "#444", fontSize: 15, lineHeight: "22px" }}>{children}</Section>
          {cta && (
            <Section style={{ marginTop: 24 }}>
              <Link href={cta.href}
                style={{ backgroundColor: LAVANDA, color: "#fff", borderRadius: 10, padding: "12px 20px", textDecoration: "none", fontWeight: 600, display: "inline-block" }}>
                {cta.label}
              </Link>
            </Section>
          )}
          <Text style={{ color: "#999", fontSize: 12, marginTop: 28 }}>Aura Maristany · Salud integral para mujeres 40+</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 2: Plantilla de mensaje nuevo**

```tsx
// lib/email/templates/NewMessageEmail.tsx
import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function NewMessageEmail({ subject, portalUrl }: { subject: string; portalUrl: string }) {
  return (
    <Layout heading="Tienes un nuevo mensaje de Aura" cta={{ href: portalUrl, label: "Ver mensaje" }}>
      <Text>Aura te envió un mensaje:</Text>
      <Text style={{ fontWeight: 600, color: "#1a1a1a" }}>{subject}</Text>
      <Text>Ábrelo en tu portal para leerlo completo.</Text>
    </Layout>
  );
}
```

- [ ] **Step 3: Plantillas de ciclo de vida**

```tsx
// lib/email/templates/WelcomeEmail.tsx
import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function WelcomeEmail({ name, portalUrl }: { name: string; portalUrl: string }) {
  return (
    <Layout heading={`¡Bienvenida, ${name}!`} cta={{ href: portalUrl, label: "Entrar a mi portal" }}>
      <Text>Tu suscripción está activa. Ya puedes empezar tu primer día de programa.</Text>
      <Text>Cualquier duda, Aura está contigo en el camino. 💜</Text>
    </Layout>
  );
}
```

```tsx
// lib/email/templates/PaymentFailedEmail.tsx
import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function PaymentFailedEmail({ name, portalUrl }: { name: string; portalUrl: string }) {
  return (
    <Layout heading="No pudimos procesar tu pago" cta={{ href: portalUrl, label: "Actualizar mi tarjeta" }}>
      <Text>Hola {name}, tu último cobro no se pudo completar.</Text>
      <Text>Actualiza tu método de pago para no perder el acceso a tu programa.</Text>
    </Layout>
  );
}
```

```tsx
// lib/email/templates/SubscriptionEndedEmail.tsx
import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function SubscriptionEndedEmail({ name, portalUrl }: { name: string; portalUrl: string }) {
  return (
    <Layout heading="Tu suscripción terminó" cta={{ href: portalUrl, label: "Reactivar" }}>
      <Text>Hola {name}, tu suscripción a Aura ha finalizado.</Text>
      <Text>Cuando quieras retomar tu camino, aquí estaremos. 💜</Text>
    </Layout>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/email/templates
git commit -m "feat(fase-4): plantillas React Email (marca Aura) para mensajería y ciclo de vida"
```

---

## Task 5: Helpers de envío best-effort (TDD)

**Files:**
- Create: `lib/email/send.ts`
- Test: `__tests__/email-send.test.ts`

- [ ] **Step 1: Escribir el test que falla**

El test mockea `./client` para no tocar la red. Verifica: (a) si no hay cliente → `{ ok: false }` sin lanzar; (b) si el cliente lanza → `{ ok: false }` sin propagar; (c) si el cliente responde ok → `{ ok: true }` y el HTML enviado contiene el asunto.

```typescript
// __tests__/email-send.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
const batchMock = vi.fn();
let resendStub: { emails: { send: typeof sendMock }; batch: { send: typeof batchMock } } | null;

vi.mock("@/lib/email/client", () => ({
  getResend: () => resendStub,
  fromAddress: () => "onboarding@resend.dev",
  appUrl: () => "https://app.test",
}));

import { sendNewMessageEmail, sendNewMessageEmailBatch } from "@/lib/email/send";

beforeEach(() => {
  sendMock.mockReset();
  batchMock.mockReset();
  resendStub = { emails: { send: sendMock }, batch: { send: batchMock } };
});

describe("sendNewMessageEmail", () => {
  it("devuelve ok:false sin lanzar cuando no hay cliente", async () => {
    resendStub = null;
    await expect(sendNewMessageEmail({ to: "a@x.com", subject: "Hola" })).resolves.toEqual({ ok: false, error: "email disabled" });
  });

  it("devuelve ok:false sin lanzar cuando el cliente arroja", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));
    const res = await sendNewMessageEmail({ to: "a@x.com", subject: "Hola" });
    expect(res.ok).toBe(false);
  });

  it("envía y devuelve ok:true con HTML que contiene el asunto", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "e1" }, error: null });
    const res = await sendNewMessageEmail({ to: "a@x.com", subject: "Mi Asunto" });
    expect(res.ok).toBe(true);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toBe("a@x.com");
    expect(payload.html).toContain("Mi Asunto");
  });
});

describe("sendNewMessageEmailBatch", () => {
  it("trocea en lotes de 100 y no lanza si el batch falla", async () => {
    batchMock.mockRejectedValue(new Error("rate"));
    const recipients = Array.from({ length: 150 }, (_, i) => `c${i}@x.com`);
    await expect(sendNewMessageEmailBatch(recipients, "Asunto")).resolves.toBeUndefined();
    expect(batchMock).toHaveBeenCalledTimes(2);
  });

  it("no hace nada si no hay cliente", async () => {
    resendStub = null;
    await expect(sendNewMessageEmailBatch(["a@x.com"], "Asunto")).resolves.toBeUndefined();
    expect(batchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm run test:run -- email-send`
Expected: FAIL (`Cannot find module '@/lib/email/send'`).

- [ ] **Step 3: Implementar los helpers**

```typescript
// lib/email/send.ts
import "server-only";
import * as React from "react";
import { render } from "@react-email/render";
import { getResend, fromAddress, appUrl } from "./client";
import { NewMessageEmail } from "./templates/NewMessageEmail";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import { PaymentFailedEmail } from "./templates/PaymentFailedEmail";
import { SubscriptionEndedEmail } from "./templates/SubscriptionEndedEmail";

export interface SendResult {
  ok: boolean;
  error?: string;
}

async function safeSend(to: string, subject: string, element: React.ReactElement): Promise<SendResult> {
  try {
    const resend = getResend();
    if (!resend) return { ok: false, error: "email disabled" };
    const html = await render(element);
    const { error } = await resend.emails.send({ from: fromAddress(), to, subject, html });
    if (error) return { ok: false, error: String(error) };
    return { ok: true };
  } catch (e) {
    console.error("[email] send failed", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const portalMessagesUrl = () => `${appUrl()}/portal/messages`;
const portalSettingsUrl = () => `${appUrl()}/portal/settings`;
const portalHomeUrl = () => `${appUrl()}/portal/today`;

export function sendNewMessageEmail({ to, subject }: { to: string; subject: string }): Promise<SendResult> {
  return safeSend(to, "Tienes un nuevo mensaje de Aura",
    React.createElement(NewMessageEmail, { subject, portalUrl: portalMessagesUrl() }));
}

export function sendWelcomeEmail({ to, name }: { to: string; name: string }): Promise<SendResult> {
  return safeSend(to, `¡Bienvenida a Aura, ${name}!`,
    React.createElement(WelcomeEmail, { name, portalUrl: portalHomeUrl() }));
}

export function sendPaymentFailedEmail({ to, name }: { to: string; name: string }): Promise<SendResult> {
  return safeSend(to, "Problema con tu pago — Aura",
    React.createElement(PaymentFailedEmail, { name, portalUrl: portalSettingsUrl() }));
}

export function sendSubscriptionEndedEmail({ to, name }: { to: string; name: string }): Promise<SendResult> {
  return safeSend(to, "Tu suscripción a Aura terminó",
    React.createElement(SubscriptionEndedEmail, { name, portalUrl: portalHomeUrl() }));
}

/** Broadcast best-effort: trocea en lotes de 100 (límite del batch endpoint de Resend). */
export async function sendNewMessageEmailBatch(recipients: string[], subject: string): Promise<void> {
  const resend = getResend();
  if (!resend || recipients.length === 0) return;
  const html = await render(React.createElement(NewMessageEmail, { subject, portalUrl: portalMessagesUrl() }));
  const emailSubject = "Tienes un nuevo mensaje de Aura";
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100).map((to) => ({ from: fromAddress(), to, subject: emailSubject, html }));
    try {
      await resend.batch.send(chunk);
    } catch (e) {
      console.error("[email] batch send failed", e);
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm run test:run -- email-send`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/email/send.ts __tests__/email-send.test.ts
git commit -m "feat(fase-4): helpers de envío de email best-effort + batch (TDD)"
```

---

## Task 6: Queries del admin (activas + enviados)

**Files:**
- Modify: `lib/admin/queries.ts` (agregar al final, conservar lo existente)

> Estas queries tocan Supabase; su lógica pura ya está cubierta por Task 2. Se verifican en el smoke. No se añade test unitario de DB.

- [ ] **Step 1: Agregar `getActiveSubscriberRows` y `getSentMessages`**

Añadir estos imports/exports a `lib/admin/queries.ts` (sin borrar lo existente):

```typescript
import {
  type ActiveSubRow,
  formatDestination,
  formatReadCount,
} from "./message-helpers";

export interface SentMessage {
  id: string;
  subject: string;
  isBroadcast: boolean;
  createdAt: string;
  total: number;
  readCount: number;
  destination: string;
  readLabel: string;
}

export async function getActiveSubscriberRows(): Promise<ActiveSubRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "profile_id, program_variant_id, profiles(full_name, email, phone), program_variants(name, program_id, programs(name))"
    )
    .eq("status", "active");

  type Raw = {
    profile_id: string;
    program_variant_id: string;
    profiles: { full_name: string | null; email: string; phone: string | null } | null;
    program_variants: { name: string; program_id: string; programs: { name: string } | null } | null;
  };

  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.profiles && r.program_variants)
    .map((r) => ({
      profile_id: r.profile_id,
      full_name: r.profiles!.full_name,
      email: r.profiles!.email,
      phone: r.profiles!.phone,
      program_variant_id: r.program_variant_id,
      variant_name: r.program_variants!.name,
      program_id: r.program_variants!.program_id,
      program_name: r.program_variants!.programs?.name ?? "",
    }));
}

export async function getSentMessages(): Promise<SentMessage[]> {
  const supabase = await createClient();
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, subject, is_broadcast, created_at")
    .order("created_at", { ascending: false });

  const { data: recips } = await supabase
    .from("message_recipients")
    .select("message_id, read_at, recipient_id, profiles(full_name)");

  type RecRow = { message_id: string; read_at: string | null; profiles: { full_name: string | null } | null };
  const byMessage = new Map<string, { total: number; read: number; singleName: string | null }>();
  for (const r of ((recips ?? []) as unknown as RecRow[])) {
    let e = byMessage.get(r.message_id);
    if (!e) {
      e = { total: 0, read: 0, singleName: null };
      byMessage.set(r.message_id, e);
    }
    e.total += 1;
    if (r.read_at) e.read += 1;
    e.singleName = r.profiles?.full_name ?? e.singleName;
  }

  type MsgRow = { id: string; subject: string; is_broadcast: boolean; created_at: string };
  return ((msgs ?? []) as unknown as MsgRow[]).map((m) => {
    const agg = byMessage.get(m.id) ?? { total: 0, read: 0, singleName: null };
    return {
      id: m.id,
      subject: m.subject,
      isBroadcast: m.is_broadcast,
      createdAt: m.created_at,
      total: agg.total,
      readCount: agg.read,
      destination: formatDestination(m.is_broadcast, agg.total, agg.singleName),
      readLabel: formatReadCount(agg.read, agg.total),
    };
  });
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/queries.ts
git commit -m "feat(fase-4): queries admin getActiveSubscriberRows + getSentMessages"
```

---

## Task 7: Server action `sendMessage`

**Files:**
- Create: `lib/admin/messageActions.ts`

- [ ] **Step 1: Implementar la action**

```typescript
// lib/admin/messageActions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getActiveSubscriberRows } from "./queries";
import { expandRecipients, type RecipientSelection } from "./message-helpers";
import { sendNewMessageEmailBatch } from "@/lib/email/send";

export interface SendMessageInput {
  subject: string;
  body: string;
  selection: RecipientSelection;
}

export interface SendMessageResult {
  ok: boolean;
  error?: string;
  count?: number;
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((prof as { role?: string } | null)?.role !== "admin") return { ok: false, error: "No autorizado" };

  if (!input.subject.trim() || !input.body.trim()) {
    return { ok: false, error: "Asunto y mensaje son obligatorios" };
  }

  const rows = await getActiveSubscriberRows();
  const recipientIds = expandRecipients(rows, input.selection);
  if (recipientIds.length === 0) return { ok: false, error: "No hay destinatarias activas para ese filtro" };

  const isBroadcast = input.selection.mode !== "individual";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msg, error: msgErr } = await (supabase as any)
    .from("messages")
    .insert({ sender_id: user.id, subject: input.subject.trim(), body: input.body.trim(), is_broadcast: isBroadcast })
    .select("id")
    .single();
  if (msgErr) return { ok: false, error: msgErr.message };

  const recipRows = recipientIds.map((rid) => ({ message_id: msg.id, recipient_id: rid }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rErr } = await (supabase as any).from("message_recipients").insert(recipRows);
  if (rErr) return { ok: false, error: rErr.message };

  // Emails best-effort — un fallo no revierte el mensaje in-app.
  const idSet = new Set(recipientIds);
  const emails = Array.from(new Set(rows.filter((r) => idSet.has(r.profile_id)).map((r) => r.email).filter(Boolean)));
  await sendNewMessageEmailBatch(emails, input.subject.trim());

  revalidatePath("/admin/messages");
  return { ok: true, count: recipientIds.length };
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/messageActions.ts
git commit -m "feat(fase-4): server action sendMessage (expande destinatarias + email best-effort)"
```

---

## Task 8: Queries del portal + action `markMessageRead`

**Files:**
- Create: `lib/content/messages.ts`
- Create: `lib/portal/messageActions.ts`

- [ ] **Step 1: Queries del portal (inbox, detalle, no-leídos)**

```typescript
// lib/content/messages.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface InboxItem {
  id: string;
  subject: string;
  preview: string;
  createdAt: string;
  read: boolean;
}

export interface MessageDetail {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
}

export async function getInboxMessages(userId: string): Promise<InboxItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_recipients")
    .select("read_at, messages(id, subject, body, created_at)")
    .eq("recipient_id", userId);

  type Raw = { read_at: string | null; messages: { id: string; subject: string; body: string; created_at: string } | null };
  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.messages)
    .map((r) => ({
      id: r.messages!.id,
      subject: r.messages!.subject,
      preview: r.messages!.body.replace(/\s+/g, " ").trim().slice(0, 80),
      createdAt: r.messages!.created_at,
      read: r.read_at != null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("message_recipients")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function getMessageDetail(userId: string, messageId: string): Promise<MessageDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_recipients")
    .select("messages(id, subject, body, created_at)")
    .eq("recipient_id", userId)
    .eq("message_id", messageId)
    .maybeSingle();

  type Raw = { messages: { id: string; subject: string; body: string; created_at: string } | null } | null;
  const row = data as unknown as Raw;
  if (!row?.messages) return null;
  return {
    id: row.messages.id,
    subject: row.messages.subject,
    body: row.messages.body,
    createdAt: row.messages.created_at,
  };
}
```

- [ ] **Step 2: Action para marcar leído**

```typescript
// lib/portal/messageActions.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function markMessageRead(messageId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Idempotente: solo escribe si está sin leer. La policy de UPDATE de la dueña (006) lo permite.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("message_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .eq("recipient_id", user.id)
    .is("read_at", null);
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/content/messages.ts lib/portal/messageActions.ts
git commit -m "feat(fase-4): queries del portal (inbox/detalle/no-leídos) + markMessageRead"
```

---

## Task 9: UI Admin — `/admin/messages`

**Files:**
- Create: `components/admin/MessagesAdmin.tsx`
- Modify: `app/admin/messages/page.tsx` (reemplaza stub)

- [ ] **Step 1: Componente cliente (composer + lista de enviados)**

```tsx
// components/admin/MessagesAdmin.tsx
"use client";

import { useState } from "react";
import type { SentMessage } from "@/lib/admin/queries";
import type { RecipientGroup } from "@/lib/admin/message-helpers";
import { whatsappUrl } from "@/lib/admin/message-helpers";
import { sendMessage } from "@/lib/admin/messageActions";

export interface ClientOption {
  id: string;
  name: string;
  whatsapp: string | null; // número normalizado o null
}

type Mode = "individual" | "broadcast";

export function MessagesAdmin({
  sent,
  groups,
  clients,
}: {
  sent: SentMessage[];
  groups: RecipientGroup[];
  clients: ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("broadcast");
  const [clientId, setClientId] = useState<string>("");
  const [allClients, setAllClients] = useState(true);
  const [variantIds, setVariantIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  // Nota: para difusión por grupos esto es un estimado de UI (suma de grupos puede
  // contar dos veces a una clienta en varias variantes). El conteo real y deduplicado
  // lo calcula el server en sendMessage (expandRecipients). "Todas" usa clientas distintas.
  const count =
    mode === "individual"
      ? clientId
        ? 1
        : 0
      : allClients
      ? clients.length
      : groups.filter((g) => variantIds.includes(g.variantId)).reduce((s, g) => s + g.count, 0);

  function toggleVariant(id: string) {
    setVariantIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  async function handleSend() {
    setError(null);
    setSending(true);
    const selection =
      mode === "individual"
        ? { mode: "individual" as const, profileId: clientId }
        : allClients
        ? { mode: "all" as const }
        : { mode: "groups" as const, variantIds };
    const res = await sendMessage({ subject, body, selection });
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "Error al enviar");
      return;
    }
    setOpen(false);
    setSubject("");
    setBody("");
    setClientId("");
    setVariantIds([]);
  }

  return (
    <div style={{ padding: "28px 32px 40px", maxWidth: 820 }}>
      <div className="row between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>Mensajes</h1>
        <button onClick={() => setOpen(true)}
          style={{ background: "var(--lavanda)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>
          + Nuevo mensaje
        </button>
      </div>

      {sent.length === 0 ? (
        <p className="font-body" style={{ color: "var(--gris-texto)" }}>Aún no has enviado mensajes.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sent.map((m) => (
            <div key={m.id}
              style={{ display: "flex", gap: 16, alignItems: "center", background: "#fff", border: "1px solid var(--gris-linea)", borderRadius: 12, padding: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: m.isBroadcast ? "var(--lavanda-tint, #efeaff)" : "var(--rosa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {m.isBroadcast ? "📢" : "👤"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-head" style={{ fontWeight: 600, fontSize: 15 }}>{m.subject}</div>
                <div className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>Para: {m.destination}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "var(--gris-suave)" }}>
                <div>{new Date(m.createdAt).toLocaleDateString("es-MX")}</div>
                <div>{m.readLabel}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
          onClick={() => !sending && setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 className="font-head" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Nuevo mensaje</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["individual", "broadcast"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                    border: "1.5px solid " + (mode === m ? "var(--lavanda)" : "var(--gris-linea)"),
                    background: mode === m ? "var(--lavanda-tint, #efeaff)" : "#fff", fontWeight: 600 }}>
                  {m === "individual" ? "👤 Individual" : "📢 Difusión"}
                </button>
              ))}
            </div>

            {mode === "individual" ? (
              <div style={{ marginBottom: 14 }}>
                <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Clienta</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)" }}>
                  <option value="">Selecciona…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {selectedClient?.whatsapp && (
                  <a href={whatsappUrl(selectedClient.whatsapp)} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-block", marginTop: 8, color: "#25D366", fontWeight: 600, fontSize: 13 }}>
                    💬 Escribir por WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Destinatarias</label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", cursor: "pointer" }}>
                  <input type="checkbox" checked={allClients} onChange={(e) => setAllClients(e.target.checked)} />
                  <span className="font-body" style={{ fontWeight: 600 }}>Todas las clientas activas</span>
                </label>
                {!allClients && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    {groups.map((g) => (
                      <label key={g.variantId} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--gris-linea)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}>
                        <input type="checkbox" checked={variantIds.includes(g.variantId)} onChange={() => toggleVariant(g.variantId)} />
                        <span className="font-body" style={{ flex: 1, fontSize: 14 }}>{g.label}</span>
                        <span style={{ fontSize: 12, color: "var(--gris-suave)" }}>{g.count}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Asunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Escribe el asunto…"
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="font-body" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Mensaje</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu mensaje…"
                style={{ width: "100%", minHeight: 120, padding: 10, borderRadius: 8, border: "1px solid var(--gris-linea)", resize: "vertical" }} />
            </div>

            {error && <p style={{ color: "var(--error, #c0392b)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

            <div className="row between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
                Se enviará a <strong>{count}</strong> clienta{count !== 1 ? "s" : ""}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setOpen(false)} disabled={sending}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--gris-linea)", background: "#fff", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={handleSend} disabled={sending || count === 0 || !subject.trim() || !body.trim()}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--lavanda)", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: sending || count === 0 ? 0.6 : 1 }}>
                  {sending ? "Enviando…" : "Enviar ahora"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Página servidor que monta el componente**

```tsx
// app/admin/messages/page.tsx
import { getSentMessages, getActiveSubscriberRows } from "@/lib/admin/queries";
import { buildRecipientGroups, normalizeWhatsappNumber } from "@/lib/admin/message-helpers";
import { MessagesAdmin, type ClientOption } from "@/components/admin/MessagesAdmin";

export default async function AdminMessagesPage() {
  const [sent, rows] = await Promise.all([getSentMessages(), getActiveSubscriberRows()]);
  const groups = buildRecipientGroups(rows);

  const clientMap = new Map<string, ClientOption>();
  for (const r of rows) {
    if (!clientMap.has(r.profile_id)) {
      clientMap.set(r.profile_id, {
        id: r.profile_id,
        name: r.full_name ?? r.email,
        whatsapp: normalizeWhatsappNumber(r.phone),
      });
    }
  }
  const clients = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return <MessagesAdmin sent={sent} groups={groups} clients={clients} />;
}
```

- [ ] **Step 3: Verificar typecheck + build parcial**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/admin/MessagesAdmin.tsx app/admin/messages/page.tsx
git commit -m "feat(fase-4): UI admin de mensajes (composer individual/difusión + enviados + WhatsApp)"
```

---

## Task 10: UI Portal — lista, detalle y badge

**Files:**
- Create: `components/portal/MessagesList.tsx`
- Modify: `app/portal/messages/page.tsx` (reemplaza stub)
- Create: `app/portal/messages/[id]/page.tsx`
- Modify: `app/portal/layout.tsx`
- Modify: `components/portal/PortalNav.tsx`

- [ ] **Step 1: Lista del portal (client, presentacional)**

```tsx
// components/portal/MessagesList.tsx
"use client";

import Link from "next/link";
import type { InboxItem } from "@/lib/content/messages";
import { whatsappUrl } from "@/lib/admin/message-helpers";

export function MessagesList({ items, auraWhatsapp }: { items: InboxItem[]; auraWhatsapp: string | null }) {
  const unread = items.filter((m) => !m.read).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 8px" }}>
        <h1 className="font-head" style={{ fontSize: 20, fontWeight: 700 }}>Mensajes</h1>
        {unread > 0 && (
          <span style={{ background: "var(--lavanda)", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
            {unread} nuevos
          </span>
        )}
      </div>

      {auraWhatsapp && (
        <div style={{ padding: "0 16px 8px" }}>
          <a href={whatsappUrl(auraWhatsapp, "Hola Aura 👋")} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#25D366", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 600, textDecoration: "none" }}>
            💬 Escríbele a Aura por WhatsApp
          </a>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px 24px" }}>
        {items.length === 0 ? (
          <p className="font-body" style={{ color: "var(--gris-suave)", textAlign: "center", marginTop: 40 }}>
            Cuando Aura te envíe algo, aparecerá aquí.
          </p>
        ) : (
          items.map((m) => (
            <Link key={m.id} href={`/portal/messages/${m.id}`}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", textDecoration: "none", color: "inherit",
                background: m.read ? "var(--gris-claro, #f4f1f1)" : "#fff",
                border: "1px solid " + (m.read ? "transparent" : "var(--gris-linea)"),
                borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--lavanda)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>A</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-head" style={{ fontWeight: 600, fontSize: 15, color: m.read ? "var(--gris-texto)" : "var(--negro)" }}>{m.subject}</div>
                <div className="font-body" style={{ fontSize: 13, color: "var(--gris-suave)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.preview}</div>
                <div style={{ fontSize: 11, color: "var(--gris-suave)", marginTop: 4 }}>{new Date(m.createdAt).toLocaleDateString("es-MX")}</div>
              </div>
              {!m.read && <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--lavanda)", flexShrink: 0, marginTop: 6 }} />}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Página de lista (servidor)**

```tsx
// app/portal/messages/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getInboxMessages } from "@/lib/content/messages";
import { normalizeWhatsappNumber } from "@/lib/admin/message-helpers";
import { MessagesList } from "@/components/portal/MessagesList";

export default async function PortalMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const items = user ? await getInboxMessages(user.id) : [];
  const auraWhatsapp = normalizeWhatsappNumber(process.env.NEXT_PUBLIC_AURA_WHATSAPP);
  return <MessagesList items={items} auraWhatsapp={auraWhatsapp} />;
}
```

- [ ] **Step 3: Página de detalle (servidor, marca leído)**

```tsx
// app/portal/messages/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessageDetail } from "@/lib/content/messages";
import { markMessageRead } from "@/lib/portal/messageActions";

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const msg = await getMessageDetail(user.id, id);
  if (!msg) notFound();

  await markMessageRead(id);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 16px 8px" }}>
        <Link href="/portal/messages" style={{ color: "var(--gris-texto)", fontSize: 14, textDecoration: "none" }}>← Mensajes</Link>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 30px" }}>
        <h1 className="font-head" style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>{msg.subject}</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--lavanda)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>A</div>
          <div>
            <div className="font-body" style={{ fontWeight: 600, fontSize: 14 }}>Aura Maristany</div>
            <div style={{ fontSize: 12, color: "var(--gris-suave)" }}>{new Date(msg.createdAt).toLocaleDateString("es-MX")}</div>
          </div>
        </div>
        <p className="font-body" style={{ whiteSpace: "pre-line", fontSize: 15.5, lineHeight: "24px", color: "var(--negro)" }}>{msg.body}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Badge en `PortalNav`**

Modificar `components/portal/PortalNav.tsx`: aceptar `unreadMessages` y pintar un puntito con número sobre el ícono de "Mensajes" (`href === "/portal/messages"`).

Cambiar la firma y el render del ícono:

```tsx
export function PortalNav({ showPilares, unreadMessages = 0 }: { showPilares: boolean; unreadMessages?: number }) {
```

Y dentro del `.map`, reemplazar el bloque del ícono por uno con badge:

```tsx
            <div style={{ position: "relative" }}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {href === "/portal/messages" && unreadMessages > 0 && (
                <span style={{ position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, padding: "0 4px",
                  borderRadius: 999, background: "var(--lavanda)", color: "#fff", fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </div>
```

(El `<Icon />` que estaba suelto se reemplaza por este `<div>` contenedor; el `<span>` del label se mantiene igual debajo.)

- [ ] **Step 5: Pasar `unreadMessages` desde el layout**

Modificar `app/portal/layout.tsx`: importar `getUnreadCount` y calcularlo junto al `showPilares`.

```tsx
import { getUnreadCount } from "@/lib/content/messages";
```

Reemplazar el cálculo de `showPilares` por ambos en paralelo y pasar la prop:

```tsx
  const [showPilares, unreadMessages] = user
    ? await Promise.all([hasPillarsAccess(user.id), getUnreadCount(user.id)])
    : [false, 0];
```

y

```tsx
        <PortalNav showPilares={showPilares} unreadMessages={unreadMessages} />
```

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add components/portal/MessagesList.tsx app/portal/messages components/portal/PortalNav.tsx app/portal/layout.tsx
git commit -m "feat(fase-4): portal de mensajes (lista + detalle read-only + WhatsApp + badge no-leídos)"
```

---

## Task 11: Emails de ciclo de vida en webhooks

**Files:**
- Modify: `lib/webhooks/stripe-handlers.ts`

> Regla dura: el email es best-effort y nunca altera el resultado del webhook. Se envuelve en try/catch propio; un fallo solo se loguea.

- [ ] **Step 1: Helper interno para obtener contacto + envíos best-effort**

Agregar al inicio de `lib/webhooks/stripe-handlers.ts` (tras los imports) los imports de email y un helper para leer email/nombre del perfil:

```typescript
import {
  sendWelcomeEmail,
  sendPaymentFailedEmail,
  sendSubscriptionEndedEmail,
} from "@/lib/email/send";

async function getProfileContact(supabase: AnyClient, profileId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase.from("profiles").select("email, full_name").eq("id", profileId).single();
  if (!data?.email) return null;
  return { email: data.email, name: data.full_name ?? "" };
}

async function getContactBySubscription(supabase: AnyClient, stripeSubscriptionId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("profiles(email, full_name)")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .single();
  const p = data?.profiles as { email: string; full_name: string | null } | null;
  if (!p?.email) return null;
  return { email: p.email, name: p.full_name ?? "" };
}
```

- [ ] **Step 2: Email de bienvenida en `handleCheckoutCompleted`**

Al final de `handleCheckoutCompleted`, después del `if (error) console.error(...)`, agregar:

```typescript
  if (!error) {
    const contact = await getProfileContact(supabase, supabase_user_id);
    if (contact) await sendWelcomeEmail({ to: contact.email, name: contact.name });
  }
```

- [ ] **Step 3: Email de pago fallido en `handlePaymentFailed`**

Al final de `handlePaymentFailed`, después del `if (error) console.error(...)`, agregar:

```typescript
  const contact = await getContactBySubscription(supabase, subscriptionId);
  if (contact) await sendPaymentFailedEmail({ to: contact.email, name: contact.name });
```

- [ ] **Step 4: Email de cancelación en `handleSubscriptionDeleted`**

Al final de `handleSubscriptionDeleted`, después del `if (error) console.error(...)`, agregar:

```typescript
  const contact = await getContactBySubscription(supabase, subscription.id);
  if (contact) await sendSubscriptionEndedEmail({ to: contact.email, name: contact.name });
```

- [ ] **Step 5: Correr los tests de webhooks existentes (no deben romperse)**

Run: `npm run test:run -- webhooks`
Expected: PASS (los tests de `computeMonthsUpdate` siguen verdes; los emails son no-op en test sin `RESEND_API_KEY`).

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/webhooks/stripe-handlers.ts
git commit -m "feat(fase-4): emails de ciclo de vida (bienvenida/pago fallido/cancelación) best-effort"
```

---

## Task 12: Gates finales + variable de entorno

**Files:**
- Modify: `.env.local` (manual, no commit — está gitignored)

- [ ] **Step 1: Agregar la variable de WhatsApp**

Agregar a `.env.local` (manual): `NEXT_PUBLIC_AURA_WHATSAPP=<tu número de prueba en formato internacional solo-dígitos, ej. 5215512345678>`.
(En producción se cambia al número de Aura.)

- [ ] **Step 2: Suite completa de tests**

Run: `npm run test:run`
Expected: PASS — incluye los nuevos `message-helpers` y `email-send`, y todo lo previo sigue verde.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build limpio.

- [ ] **Step 6: Commit (si lint/build generan ajustes)**

```bash
git add -A
git commit -m "chore(fase-4): gates verdes (tests, tsc, lint, build)"
```

---

## Smoke manual (tras los gates, con DEV_DATE / cuentas de prueba)

1. Admin `/admin/messages` → enviar **individual** a una clienta → esa clienta lo ve en `/portal/messages`; otra clienta NO lo ve.
2. Admin → **difusión** "Todas" y **difusión por variante** (checkboxes con conteo) → llega a las objetivo; abrir el detalle marca `read_at` y el badge baja.
3. Botón WhatsApp: en el portal abre el chat con el número de `NEXT_PUBLIC_AURA_WHATSAPP`; en admin (individual con teléfono) abre el de la clienta.
4. Email (si `RESEND_FROM_EMAIL=onboarding@resend.dev` y key configurada): llega "Tienes un nuevo mensaje de Aura" con branding; un fallo de Resend NO rompe el envío in-app.
5. Ciclo de vida: con `stripe listen` corriendo, un checkout dispara bienvenida; un pago fallido / cancelación disparan sus emails (best-effort).
6. RLS: como clienta, intentar leer un `message_id` ajeno por la app → 404; el badge refleja el conteo correcto.

---

## Self-Review (cobertura del spec)

- §2 Migración 006 → Task 1. ✅
- §3 `lib/email/` (client/send/templates, no-op, batch) → Tasks 3,4,5. ✅
- §4 Admin (`getSentMessages`, composer individual/broadcast por variante, `sendMessage`, activas) → Tasks 6,7,9. ✅
- §5 Portal (inbox, detalle 404+read, badge server-render, WhatsApp a Aura) → Tasks 8,10. ✅
- §6 Emails de ciclo de vida en webhooks (welcome/payment_failed/canceled, best-effort) → Task 11. ✅
- §7 Testing (helpers puros, email best-effort, smoke RLS) → Tasks 2,5,12 + smoke. ✅
- §8 Env (`NEXT_PUBLIC_AURA_WHATSAPP`, Resend dev) → Task 12. ✅
- WhatsApp admin reubicado al composer (la ficha de clientas no existe; es Fase 5). ✅
- Fuera de alcance (CSV→Fase 5, bidireccional, borradores, realtime, Zapier, recibo invoice.paid, recordatorio pre-cobro) → no se implementan. ✅

**Consistencia de tipos:** `ActiveSubRow`/`RecipientSelection`/`RecipientGroup` (Task 2) se reusan idénticos en Tasks 6,7,9. `SentMessage`/`InboxItem`/`MessageDetail`/`ClientOption`/`SendMessageInput` definidos una vez y consumidos coherentemente. `getUnreadCount`/`markMessageRead`/`sendMessage`/`sendNewMessageEmailBatch` nombrados igual donde se invocan.
