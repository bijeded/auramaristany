import { describe, it, expect } from "vitest";
import {
  isCompletionScheduled,
  CANCELLATION_REASON_OPTIONS,
  cancellationReasonLabel,
  reasonRequiresDetail,
  deriveCancellationState,
  isChurned,
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

  // L2c — terminar NO es estar en la ventana de gracia. La completion programa
  // la cancelación en Stripe, así que `cancel_at_period_end` también queda en
  // true: si el estado no se mirara PRIMERO, a quien acaba de terminar le
  // ofreceríamos "Reactivar" un programa que ya se acabó, reanudando el cobro.
  it("es 'completed' cuando el estado es completed, aunque cancele a fin de periodo", () => {
    const s = deriveCancellationState({
      status: "completed",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-08-15T00:00:00Z",
    });
    expect(s.kind).toBe("completed");
    if (s.kind === "completed") expect(s.endsAt).toBe("2026-08-15T00:00:00Z");
  });

  it("es 'completed' también antes de que Stripe marque la cancelación", () => {
    expect(deriveCancellationState({ status: "completed", cancelAtPeriodEnd: false }).kind).toBe(
      "completed"
    );
  });

  // El agujero que abre mover la escritura del estado: durante el ÚLTIMO mes ya
  // pagado la fila sigue en `active` con `cancel_at_period_end` en true, que es
  // exactamente la forma de la ventana de gracia. Sin mirar `completed_at`, la
  // pantalla le ofrece "Reactivar", que borra la cancelación en Stripe y le
  // cobra un mes 7 que no existe: el defecto que este cambio viene a quitar.
  it("es 'completing' en el último mes pagado, aunque el estado siga en active", () => {
    const s = deriveCancellationState({
      status: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: "2026-08-15T00:00:00Z",
      completedAt: "2026-07-15T00:00:00Z",
    });
    expect(s.kind).toBe("completing");
    if (s.kind === "completing") expect(s.endsAt).toBe("2026-08-15T00:00:00Z");
  });

  it("'completing' no ofrece Reactivar: no es la ventana de gracia", () => {
    expect(
      deriveCancellationState({
        status: "active",
        cancelAtPeriodEnd: true,
        completedAt: "2026-07-15T00:00:00Z",
      }).kind
    ).not.toBe("grace");
  });

  it("una cancelación voluntaria normal sigue siendo 'grace'", () => {
    expect(
      deriveCancellationState({ status: "active", cancelAtPeriodEnd: true, completedAt: null }).kind
    ).toBe("grace");
  });

  it("terminada gana a programada cuando llegan las dos", () => {
    expect(
      deriveCancellationState({
        status: "completed",
        cancelAtPeriodEnd: true,
        completedAt: "2026-07-15T00:00:00Z",
      }).kind
    ).toBe("completed");
  });

  it("no es ni 'grace' ni 'eligible': ni Reactivar ni Cancelar mi plan", () => {
    const kind = deriveCancellationState({ status: "completed", cancelAtPeriodEnd: true }).kind;
    expect(kind).not.toBe("grace");
    expect(kind).not.toBe("eligible");
  });
});

// Una sola derivación para un estado que viven dos columnas. Existe porque cada
// lector que se lo dedujo por su cuenta se equivocó en un subconjunto distinto:
// la ficha, las acciones de servidor y el admin llaman aquí.
describe("isCompletionScheduled", () => {
  it("hacen falta las dos señales", () => {
    expect(isCompletionScheduled({ completedAt: "2026-07-01", cancelAtPeriodEnd: true })).toBe(true);
  });

  // El caso que importa: L2b escribía `completed_at` sin cancelar nada en
  // Stripe. Esa fila SIGUE cobrando, así que tratarla como terminada le diría a
  // la cliente que no se le cobrará justo el día que se le cobra —y le quitaría
  // el botón de cancelar, su única forma de pararlo.
  it("una marca vieja sin cancelación programada no cuenta", () => {
    expect(isCompletionScheduled({ completedAt: "2026-07-01", cancelAtPeriodEnd: false })).toBe(false);
  });

  it("ni una cancelación voluntaria sin plazo cumplido", () => {
    expect(isCompletionScheduled({ completedAt: null, cancelAtPeriodEnd: true })).toBe(false);
  });

  it("ni una suscripción corriente", () => {
    expect(isCompletionScheduled({ completedAt: null, cancelAtPeriodEnd: false })).toBe(false);
    expect(isCompletionScheduled({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dashboard-cancellation-charts: isChurned
// ---------------------------------------------------------------------------

/**
 * La matriz cubre los NUEVE valores del CHECK de `subscriptions.status`
 * (migración 017), no los que hoy parezcan relevantes. Es el punto de la regla
 * 8: una unión más angosta que el CHECK no la ve ni `tsc` ni el lint, y aquí
 * decidiría si alguien cuenta como baja.
 */
describe("isChurned", () => {
  it("una suscripción cancelada es baja", () => {
    expect(isChurned("canceled")).toBe(true);
  });

  /**
   * El caso que justifica que esta función exista. `handleSubscriptionDeleted`
   * ya separó los dos finales —escribe `completed` a quien terminó su plazo y
   * `canceled` a quien se fue—, así que quien se gradúa NUNCA llega con
   * `canceled`. Contarla como baja convertiría el mejor desenlace de Aura en su
   * peor métrica.
   */
  it("quien se gradúa no es baja jamás", () => {
    expect(isChurned("completed")).toBe(false);
  });

  it("una que se está acabando todavía no es baja: no ha terminado", () => {
    // Ya la cuenta "Cancelaciones (próx. 7 días)" desde el balde `cancelling`.
    expect(isChurned("active")).toBe(false);
  });

  /**
   * `unpaid` va en el DENOMINADOR y no en el numerador: el listado de clientes
   * ya archiva `past_due` y `unpaid` juntas bajo "Vencidas" y pinta `unpaid`
   * como "Impaga" en ámbar. La lectura de Aura es cliente en apuros, no cliente
   * que se fue — y si acaba yéndose de verdad, llega su fila `pago_fallido`.
   */
  it("una impaga no es baja", () => {
    expect(isChurned("unpaid")).toBe(false);
  });

  it("ni una vencida, en prueba o pausada", () => {
    expect(isChurned("past_due")).toBe(false);
    expect(isChurned("trialing")).toBe(false);
    expect(isChurned("paused")).toBe(false);
  });

  it("un checkout abandonado no es baja: nunca fue cliente", () => {
    expect(isChurned("incomplete")).toBe(false);
    expect(isChurned("incomplete_expired")).toBe(false);
  });
});
