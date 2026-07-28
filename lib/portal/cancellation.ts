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
  | { kind: "completed"; endsAt: string | null }
  | { kind: "none" };

/** Derive how the SubscriptionCard should present cancellation, from the
 *  subscription's status + cancel_at_period_end flag. Pure — no dates/"now". */
export function deriveCancellationState(input: {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string | null;
}): CancellationState {
  // L2c — el ESTADO se mira primero. Terminar el programa también deja
  // `cancel_at_period_end` en true (la completion programa la cancelación en
  // Stripe), así que mirar sólo la bandera le ofrecería "Reactivar" a quien
  // acaba de terminar: reanudar el cobro de un contenido que ya se acabó.
  if (input.status === "completed") {
    return { kind: "completed", endsAt: input.currentPeriodEnd ?? null };
  }

  if (input.cancelAtPeriodEnd && ELIGIBLE_STATUSES.includes(input.status)) {
    return { kind: "grace", endsAt: input.currentPeriodEnd ?? null };
  }
  if (ELIGIBLE_STATUSES.includes(input.status)) return { kind: "eligible" };
  return { kind: "none" };
}
