import { describe, it, expect } from "vitest";
import { filterClients, isInactive, type ClientListRow } from "@/lib/admin/clients-helpers";

const NOW = "2026-07-15";

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
  last_activity_date: NOW, // reciente por defecto
};

const rows: ClientListRow[] = [
  base,
  { ...base, profile_id: "p2", full_name: "Beatriz Ruiz", email: "bea@x.com", status: "past_due", program_name: "Strong & Fit" },
  { ...base, profile_id: "p3", full_name: "Carla Díaz", email: "carla@x.com", status: "canceled" },
];

describe("isInactive", () => {
  it("actividad más vieja que el umbral ⇒ inactivo", () => {
    expect(isInactive("2026-07-04", NOW, 10)).toBe(true); // 11 días
  });
  it("actividad exactamente en el umbral ⇒ inactivo", () => {
    expect(isInactive("2026-07-05", NOW, 10)).toBe(true); // 10 días
  });
  it("actividad reciente dentro del umbral ⇒ activo", () => {
    expect(isInactive("2026-07-06", NOW, 10)).toBe(false); // 9 días
  });
  it("nunca registró (null) ⇒ inactivo sin importar now", () => {
    expect(isInactive(null, NOW, 10)).toBe(true);
  });
});

describe("filterClients", () => {
  it("sin filtros devuelve todas las filas", () => {
    expect(filterClients(rows, { query: "", program: "Todas", status: null, now: NOW })).toHaveLength(3);
  });
  it("busca por nombre o correo, case-insensitive", () => {
    expect(filterClients(rows, { query: "bea", program: "Todas", status: null, now: NOW })).toHaveLength(1);
    expect(filterClients(rows, { query: "ANA@", program: "Todas", status: null, now: NOW })[0].profile_id).toBe("p1");
  });
  it("filtra por programa", () => {
    const r = filterClients(rows, { query: "", program: "Strong & Fit", status: null, now: NOW });
    expect(r).toHaveLength(1);
    expect(r[0].profile_id).toBe("p2");
  });
  it("filtra 'Activas' por status active", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Activas", now: NOW });
    expect(r.map((x) => x.profile_id)).toEqual(["p1"]);
  });
  it("filtra 'Vencidas' por past_due o unpaid", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Vencidas", now: NOW });
    expect(r.map((x) => x.profile_id)).toEqual(["p2"]);
  });
  it("filtra 'Canceladas' por canceled", () => {
    const r = filterClients(rows, { query: "", program: "Todas", status: "Canceladas", now: NOW });
    expect(r.map((x) => x.profile_id)).toEqual(["p3"]);
  });

  describe("'Sin actividad'", () => {
    const inactiveActive = { ...base, profile_id: "q1", status: "active" as const, last_activity_date: "2026-07-01" }; // 14 días
    const inactiveTrialing = { ...base, profile_id: "q2", status: "trialing" as const, last_activity_date: null };
    const activeRecent = { ...base, profile_id: "q3", status: "active" as const, last_activity_date: NOW };
    const inactiveCanceled = { ...base, profile_id: "q4", status: "canceled" as const, last_activity_date: "2026-01-01" };
    const set = [inactiveActive, inactiveTrialing, activeRecent, inactiveCanceled];

    it("incluye clientes active/trialing sin actividad ≥10 días (o sin registros)", () => {
      const r = filterClients(set, { query: "", program: "Todas", status: "Sin actividad", now: NOW });
      expect(r.map((x) => x.profile_id).sort()).toEqual(["q1", "q2"]);
    });
    it("excluye cancelados aunque estén inactivos", () => {
      const r = filterClients(set, { query: "", program: "Todas", status: "Sin actividad", now: NOW });
      expect(r.map((x) => x.profile_id)).not.toContain("q4");
    });
    it("excluye activos con actividad reciente", () => {
      const r = filterClients(set, { query: "", program: "Todas", status: "Sin actividad", now: NOW });
      expect(r.map((x) => x.profile_id)).not.toContain("q3");
    });
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
