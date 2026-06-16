import { describe, it, expect } from "vitest";
import { filterClients, type ClientListRow } from "@/lib/admin/clients-helpers";

const base: ClientListRow = {
  profile_id: "p1",
  full_name: "Ana López",
  email: "ana@example.com",
  phone: null,
  program_name: "CuarentaMás",
  variant_name: "Base",
  enrollment_date: "2026-01-01",
  current_period_end: "2026-07-01",
  price_mxn: 999,
  status: "active",
};

const rows: ClientListRow[] = [
  base,
  { ...base, profile_id: "p2", full_name: "Beatriz Ruiz", email: "bea@x.com", status: "past_due", program_name: "Strong & Fit" },
  { ...base, profile_id: "p3", full_name: "Carla Díaz", email: "carla@x.com", status: "canceled" },
];

describe("filterClients", () => {
  it("sin filtros devuelve todas las filas", () => {
    expect(filterClients(rows, { query: "", program: "Todas", status: null })).toHaveLength(3);
  });
  it("busca por nombre o correo, case-insensitive", () => {
    expect(filterClients(rows, { query: "bea", program: "Todas", status: null })).toHaveLength(1);
    expect(filterClients(rows, { query: "ANA@", program: "Todas", status: null })[0].profile_id).toBe("p1");
  });
  it("filtra por programa", () => {
    const r = filterClients(rows, { query: "", program: "Strong & Fit", status: null });
    expect(r).toHaveLength(1);
    expect(r[0].profile_id).toBe("p2");
  });
  it("filtra 'Activas' por status active", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Activas" });
    expect(r.map((x) => x.profile_id)).toEqual(["p1"]);
  });
  it("filtra 'Vencidas' por past_due o unpaid", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Vencidas" });
    expect(r.map((x) => x.profile_id)).toEqual(["p2"]);
  });
  it("filtra 'Canceladas' por canceled", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Canceladas" });
    expect(r.map((x) => x.profile_id)).toEqual(["p3"]);
  });
});

import { pickPrimarySubscription, type SubLike } from "@/lib/admin/clients-helpers";

describe("pickPrimarySubscription", () => {
  const mk = (o: Partial<SubLike>): SubLike => ({
    status: "active", current_period_end: null, enrollment_date: "2026-01-01", created_at: "2026-01-01T00:00:00Z", ...o,
  });
  it("devuelve null sin suscripciones", () => {
    expect(pickPrimarySubscription([])).toBeNull();
  });
  it("prefiere la activa con current_period_end más lejano", () => {
    const a = mk({ status: "active", current_period_end: "2026-07-01" });
    const b = mk({ status: "active", current_period_end: "2026-09-01" });
    expect(pickPrimarySubscription([a, b])).toBe(b);
  });
  it("si no hay activa, toma la más reciente por enrollment_date", () => {
    const a = mk({ status: "canceled", enrollment_date: "2025-01-01" });
    const b = mk({ status: "canceled", enrollment_date: "2026-01-01" });
    expect(pickPrimarySubscription([a, b])).toBe(b);
  });
  it("una activa gana a una cancelada más reciente", () => {
    const act = mk({ status: "active", current_period_end: "2026-07-01", enrollment_date: "2025-01-01" });
    const can = mk({ status: "canceled", enrollment_date: "2026-06-01" });
    expect(pickPrimarySubscription([can, act])).toBe(act);
  });
});

import { subscriptionProgressLabel } from "@/lib/admin/clients-helpers";

describe("subscriptionProgressLabel", () => {
  it("programa de término fijo muestra 'Mes N de D'", () => {
    expect(subscriptionProgressLabel(
      { months_elapsed: 3 },
      { billing_model: "fixed_term_monthly", duration_months: 6 }
    )).toBe("Mes 3 de 6");
  });
  it("programa rolling muestra solo 'Mes N'", () => {
    expect(subscriptionProgressLabel(
      { months_elapsed: 5 },
      { billing_model: "rolling_monthly", duration_months: null }
    )).toBe("Mes 5");
  });
});

import { canDeleteClient } from "@/lib/admin/clients-helpers";

describe("canDeleteClient", () => {
  it("permite borrar si no hay suscripciones", () => {
    expect(canDeleteClient([])).toEqual({ ok: true });
  });
  it("permite borrar si todas están canceladas", () => {
    expect(canDeleteClient([{ status: "canceled" }, { status: "canceled" }])).toEqual({ ok: true });
  });
  it("bloquea si hay una activa", () => {
    const r = canDeleteClient([{ status: "canceled" }, { status: "active" }]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
  it("bloquea si hay past_due o unpaid", () => {
    expect(canDeleteClient([{ status: "past_due" }]).ok).toBe(false);
    expect(canDeleteClient([{ status: "unpaid" }]).ok).toBe(false);
  });
});

import { clientsToCSV } from "@/lib/admin/clients-helpers";

describe("clientsToCSV", () => {
  it("incluye encabezado y una fila por cliente", () => {
    const csv = clientsToCSV([base]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Nombre,Email,Programa,Variante,Estado,Inscripción");
    expect(lines[1]).toBe("Ana López,ana@example.com,CuarentaMás,Base,Activa,2026-01-01");
  });
  it("escapa comas y comillas envolviendo en comillas dobles", () => {
    const csv = clientsToCSV([{ ...base, full_name: 'Díaz, "La" Ana' }]);
    expect(csv.split("\n")[1].startsWith('"Díaz, ""La"" Ana",')).toBe(true);
  });
  it("traduce el status a etiqueta en español", () => {
    const csv = clientsToCSV([{ ...base, status: "past_due" }]);
    expect(csv.split("\n")[1]).toContain("Pago fallido");
  });
});
