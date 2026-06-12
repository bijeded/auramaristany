import { describe, it, expect } from "vitest";
import { decideAdminAccess } from "@/lib/admin/auth";

describe("decideAdminAccess", () => {
  it("rechaza sin usuario", () => {
    expect(decideAdminAccess(null, null)).toEqual({ ok: false, error: "No autenticado" });
  });
  it("rechaza usuario no-admin", () => {
    expect(decideAdminAccess({ id: "u1" }, "client")).toEqual({ ok: false, error: "No autorizado" });
  });
  it("rechaza rol nulo", () => {
    expect(decideAdminAccess({ id: "u1" }, null)).toEqual({ ok: false, error: "No autorizado" });
  });
  it("acepta admin", () => {
    expect(decideAdminAccess({ id: "u1" }, "admin")).toEqual({ ok: true });
  });
});
