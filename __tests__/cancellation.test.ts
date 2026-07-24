import { describe, it, expect } from "vitest";
import {
  CANCELLATION_REASON_OPTIONS,
  cancellationReasonLabel,
  reasonRequiresDetail,
  deriveCancellationState,
} from "@/lib/portal/cancellation";

// A9 — Cancellation + exit survey: pure helpers
describe("cancellationReasonLabel", () => {
  it("maps each reason to a Spanish label", () => {
    expect(cancellationReasonLabel("precio_muy_caro")).toBe("Precio muy caro");
    expect(cancellationReasonLabel("no_tengo_tiempo")).toBe("No tengo tiempo");
    expect(cancellationReasonLabel("no_logre_objetivo")).toBe("No logré el objetivo");
    expect(cancellationReasonLabel("no_veo_resultados")).toBe("No veo resultados");
    expect(cancellationReasonLabel("encontre_otra_opcion")).toBe("Encontré otra opción");
    expect(cancellationReasonLabel("otro")).toBe("Otro");
    expect(cancellationReasonLabel("pago_fallido")).toBe("Pago fallido");
  });
});

describe("CANCELLATION_REASON_OPTIONS", () => {
  it("excludes the system-only pago_fallido from UI options", () => {
    const values = CANCELLATION_REASON_OPTIONS.map((o) => o.value);
    expect(values).not.toContain("pago_fallido");
  });

  it("lists the six client-facing reasons in order", () => {
    expect(CANCELLATION_REASON_OPTIONS.map((o) => o.value)).toEqual([
      "precio_muy_caro",
      "no_tengo_tiempo",
      "no_logre_objetivo",
      "no_veo_resultados",
      "encontre_otra_opcion",
      "otro",
    ]);
  });
});

describe("reasonRequiresDetail", () => {
  it("is true for the free-text reasons", () => {
    expect(reasonRequiresDetail("encontre_otra_opcion")).toBe(true);
    expect(reasonRequiresDetail("otro")).toBe(true);
  });

  it("is false for the fixed reasons", () => {
    expect(reasonRequiresDetail("precio_muy_caro")).toBe(false);
    expect(reasonRequiresDetail("no_veo_resultados")).toBe(false);
  });
});

describe("deriveCancellationState", () => {
  it("is 'eligible' for an active subscription not set to cancel", () => {
    const s = deriveCancellationState({ status: "active", cancelAtPeriodEnd: false });
    expect(s.kind).toBe("eligible");
  });

  it("is 'eligible' for trialing and past_due too", () => {
    expect(deriveCancellationState({ status: "trialing", cancelAtPeriodEnd: false }).kind).toBe("eligible");
    expect(deriveCancellationState({ status: "past_due", cancelAtPeriodEnd: false }).kind).toBe("eligible");
  });

  it("is 'grace' when cancel_at_period_end is true", () => {
    const s = deriveCancellationState({
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-08-15T00:00:00Z",
    });
    expect(s.kind).toBe("grace");
    if (s.kind === "grace") expect(s.endsAt).toBe("2026-08-15T00:00:00Z");
  });

  it("is 'none' for canceled or unpaid subscriptions", () => {
    expect(deriveCancellationState({ status: "canceled", cancelAtPeriodEnd: false }).kind).toBe("none");
    expect(deriveCancellationState({ status: "unpaid", cancelAtPeriodEnd: false }).kind).toBe("none");
  });
});
