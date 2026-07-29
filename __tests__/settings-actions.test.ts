import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; op: string; payload?: unknown; eqArgs?: unknown[] }[] = [];
let userId: string | null = "user-1";
// Per-table result for select-chains ending in maybeSingle()/single().
let queryResults: Record<string, unknown> = {};
let insertError: unknown = null;

function makeQuery(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    in: () => q,
    is: () => q,
    order: () => q,
    limit: () => q,
    maybeSingle: () => Promise.resolve({ data: queryResults[table] ?? null, error: null }),
    single: () => Promise.resolve({ data: queryResults[table] ?? null, error: null }),
    insert: (payload: unknown) => { calls.push({ table, op: "insert", payload }); return Promise.resolve({ error: insertError }); },
    update: (payload: unknown) => ({
      eq: (_col: string, val: unknown) => { calls.push({ table, op: "update", payload, eqArgs: [val] }); return Promise.resolve({ error: null }); },
    }),
    delete: () => ({
      eq: (_col: string, val: unknown) => { calls.push({ table, op: "delete", eqArgs: [val] }); return Promise.resolve({ error: null }); },
    }),
  };
  return q;
}

const fakeServer = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: userId ? { id: userId, email: "c@x.com" } : null } }),
    updateUser: vi.fn((payload: unknown) => { calls.push({ table: "auth", op: "updateUser", payload }); return Promise.resolve({ error: null }); }),
  },
  from: (table: string) => makeQuery(table),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => fakeServer) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const stripeUpdate = vi.fn((..._a: unknown[]) => Promise.resolve({}));
vi.mock("@/lib/stripe", () => ({ stripe: { subscriptions: { update: (...a: unknown[]) => stripeUpdate(...a) } } }));

// Cliente stateless para verificar la contraseña actual (lo usa updatePassword en una task posterior)
const statelessSignIn = vi.fn(() => Promise.resolve({ error: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithPassword: statelessSignIn } })),
}));

import { updateAccount, updatePassword, cancelSubscription, reactivateSubscription } from "@/lib/portal/settingsActions";

beforeEach(() => {
  calls.length = 0;
  userId = "user-1";
  queryResults = {};
  insertError = null;
  stripeUpdate.mockReset();
  stripeUpdate.mockResolvedValue({});
  statelessSignIn.mockReset();
  statelessSignIn.mockResolvedValue({ error: null });
});

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    statelessSignIn.mockResolvedValueOnce({ error: { message: "invalid" } } as any);
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

const OWNED_SUB = { id: "sub-1", stripe_subscription_id: "sub_stripe_1", status: "active" };

describe("cancelSubscription", () => {
  it("inserta la encuesta (voluntary) y pone cancel_at_period_end en Stripe", async () => {
    queryResults = { subscriptions: OWNED_SUB };
    const r = await cancelSubscription({ reason: "precio_muy_caro" });
    expect(r).toEqual({ ok: true });
    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.table).toBe("cancellation_surveys");
    expect(insert?.payload).toMatchObject({ profile_id: "user-1", subscription_id: "sub-1", reason: "precio_muy_caro", source: "voluntary", detail: null });
    expect(stripeUpdate).toHaveBeenCalledWith("sub_stripe_1", { cancel_at_period_end: true });
  });

  it("sin razón usa 'otro' y sigue cancelando", async () => {
    queryResults = { subscriptions: OWNED_SUB };
    const r = await cancelSubscription({});
    expect(r.ok).toBe(true);
    expect(calls.find((c) => c.op === "insert")?.payload).toMatchObject({ reason: "otro", source: "voluntary" });
  });

  it("sanitiza y guarda el detalle en razones de texto libre", async () => {
    queryResults = { subscriptions: OWNED_SUB };
    await cancelSubscription({ reason: "otro", detail: "  <b>muy caro</b>  " });
    expect(calls.find((c) => c.op === "insert")?.payload).toMatchObject({ detail: "muy caro" });
  });

  it("ignora el detalle en razones que no lo llevan", async () => {
    queryResults = { subscriptions: OWNED_SUB };
    await cancelSubscription({ reason: "no_tengo_tiempo", detail: "algo" });
    expect(calls.find((c) => c.op === "insert")?.payload).toMatchObject({ detail: null });
  });

  it("rechaza sin suscripción cancelable, sin llamar a Stripe ni insertar", async () => {
    queryResults = { subscriptions: null };
    const r = await cancelSubscription({ reason: "otro" });
    expect(r.ok).toBe(false);
    expect(stripeUpdate).not.toHaveBeenCalled();
    expect(calls.find((c) => c.op === "insert")).toBeUndefined();
  });

  it("falla genérico sin sesión", async () => {
    userId = null;
    const r = await cancelSubscription({ reason: "otro" });
    expect(r.ok).toBe(false);
    expect(stripeUpdate).not.toHaveBeenCalled();
  });
});

describe("reactivateSubscription", () => {
  it("quita cancel_at_period_end en Stripe y borra la fila voluntary más reciente", async () => {
    queryResults = { subscriptions: OWNED_SUB, cancellation_surveys: { id: "srv-9" } };
    const r = await reactivateSubscription();
    expect(r).toEqual({ ok: true });
    expect(stripeUpdate).toHaveBeenCalledWith("sub_stripe_1", { cancel_at_period_end: false });
    const del = calls.find((c) => c.op === "delete");
    expect(del?.table).toBe("cancellation_surveys");
    expect(del?.eqArgs).toEqual(["srv-9"]);
  });

  it("no borra nada si no hay fila voluntary", async () => {
    queryResults = { subscriptions: OWNED_SUB, cancellation_surveys: null };
    const r = await reactivateSubscription();
    expect(r.ok).toBe(true);
    expect(calls.find((c) => c.op === "delete")).toBeUndefined();
  });
});
