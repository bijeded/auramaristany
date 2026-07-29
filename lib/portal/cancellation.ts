import type { CancellationReason, SubscriptionStatus } from "@/lib/supabase/types";

// A9 — Cancellation + exit survey. Pure helpers shared by the cancel modal,
// the SubscriptionCard, and the cancel server action's validation.

const REASON_LABELS: Record<CancellationReason, string> = {
  precio_muy_caro: "Precio muy caro",
  no_tengo_tiempo: "No tengo tiempo",
  no_logre_objetivo: "No logré el objetivo",
  no_veo_resultados: "No veo resultados",
  encontre_otra_opcion: "Encontré otra opción",
  otro: "Otro",
  pago_fallido: "Pago fallido",
};

export function cancellationReasonLabel(reason: CancellationReason): string {
  return REASON_LABELS[reason];
}

/** Reasons whose row carries a free-text `detail`. */
const DETAIL_REASONS: readonly CancellationReason[] = ["encontre_otra_opcion", "otro"];

export function reasonRequiresDetail(reason: CancellationReason): boolean {
  return DETAIL_REASONS.includes(reason);
}

/** Client-facing survey options — order matters for the radio list.
 *  `pago_fallido` is system-only and deliberately excluded. */
export const CANCELLATION_REASON_OPTIONS: ReadonlyArray<{ value: CancellationReason; label: string }> = [
  "precio_muy_caro",
  "no_tengo_tiempo",
  "no_logre_objetivo",
  "no_veo_resultados",
  "encontre_otra_opcion",
  "otro",
].map((value) => ({ value: value as CancellationReason, label: REASON_LABELS[value as CancellationReason] }));

const ELIGIBLE_STATUSES: readonly SubscriptionStatus[] = ["active", "trialing", "past_due"];

export type CancellationState =
  | { kind: "eligible" }
  | { kind: "grace"; endsAt: string | null }
  /** Último mes ya pagado: la completion está programada, aún hay contenido. */
  | { kind: "completing"; endsAt: string | null }
  | { kind: "completed"; endsAt: string | null }
  | { kind: "none" };

/** Derive how the SubscriptionCard should present cancellation, from the
 *  subscription's status + cancel_at_period_end flag. Pure — no dates/"now". */
export function deriveCancellationState(input: {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string | null;
  /** Sellado cuando la completion queda PROGRAMADA, un mes antes del estado. */
  completedAt?: string | null;
}): CancellationState {
  // L2c — terminar no es la ventana de gracia, y hay que mirarlo antes que la
  // bandera. Un programa de plazo fijo pasa por DOS momentos, y los dos dejan
  // `cancel_at_period_end` en true:
  //
  //   1. `completing` — empieza su último mes ya pagado. Sigue entrenando, pero
  //      ofrecerle "Reactivar" aquí borraría la cancelación en Stripe y le
  //      cobraría un mes 7 que no existe: exactamente el defecto que este
  //      cambio viene a quitar.
  //   2. `completed`  — terminó el periodo. Ni Reactivar ni Cancelar: no queda
  //      nada que reactivar ni que cancelar.
  if (input.status === "completed") {
    return { kind: "completed", endsAt: input.currentPeriodEnd ?? null };
  }
  // Se exigen las DOS señales. `completed_at` por sí solo no basta: es una
  // columna que ya existía y que L2b escribía sin cancelar nada en Stripe, así
  // que una fila vieja lo trae puesto sin que haya ninguna cancelación
  // programada. Prometerle "no habrá más cobros" a partir de esa marca sería
  // mentirle justo sobre el cobro.
  if (input.completedAt && input.cancelAtPeriodEnd) {
    return { kind: "completing", endsAt: input.currentPeriodEnd ?? null };
  }

  if (input.cancelAtPeriodEnd && ELIGIBLE_STATUSES.includes(input.status)) {
    return { kind: "grace", endsAt: input.currentPeriodEnd ?? null };
  }
  if (ELIGIBLE_STATUSES.includes(input.status)) return { kind: "eligible" };
  return { kind: "none" };
}
