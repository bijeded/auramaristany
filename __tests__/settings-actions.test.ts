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

// Cliente stateless para verificar la contraseña actual (lo usa updatePassword en una task posterior)
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
