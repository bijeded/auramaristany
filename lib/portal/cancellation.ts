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

/**
 * Pinta un motivo de baja para que lo lea una persona.
 *
 * Única tabla de etiquetas de motivo, y por eso la llama también "Razones de
 * cancelación" en el dashboard en vez de escribir su propia copia: dos mapas
 * del mismo enum son una tabla copiada (regla 8) y se separan en el siguiente
 * motivo que se agregue.
 */
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

/**
 * ¿Está PROGRAMADO el final de esta suscripción?
 *
 * Única derivación de un estado que viven DOS columnas, y la razón de que sea
 * una sola función: `completed_at` por sí solo no prueba nada. L2b lo escribía
 * al llegar al último mes sin cancelar nada en Stripe, así que una fila vieja
 * puede traerlo puesto y seguir cobrando tan campante. Hacen falta las dos
 * señales: que el plazo se haya cumplido Y que la cancelación exista de verdad.
 *
 * Cada lector que se la deduzca por su cuenta se equivoca en un subconjunto
 * distinto —ya pasó tres veces en este mismo cambio—, así que la pantalla, las
 * acciones de servidor y el admin llaman aquí.
 */
export function isCompletionScheduled(row: {
  completedAt?: string | null;
  cancelAtPeriodEnd?: boolean | null;
}): boolean {
  return !!row.completedAt && row.cancelAtPeriodEnd === true;
}

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
  if (isCompletionScheduled(input)) {
    return { kind: "completing", endsAt: input.currentPeriodEnd ?? null };
  }

  if (input.cancelAtPeriodEnd && ELIGIBLE_STATUSES.includes(input.status)) {
    return { kind: "grace", endsAt: input.currentPeriodEnd ?? null };
  }
  if (ELIGIBLE_STATUSES.includes(input.status)) return { kind: "eligible" };
  return { kind: "none" };
}

/**
 * ¿Esta suscripción TERMINÓ en baja?
 *
 * Segunda derivación al lado de `deriveCancellationState`, y a propósito. Las
 * dos contestan preguntas distintas:
 *
 *   - `deriveCancellationState` → "¿qué puede hacer AHORA esta suscripción
 *     viva?". Decide qué botones ve la cliente, y una fila terminal en
 *     `canceled` se le cae hasta `none`.
 *   - `isChurned` → "¿cómo TERMINÓ?". Es la pregunta histórica de las cartas de
 *     fuga, y la primera no puede contestarla: pedirle el numerador devolvería
 *     cero en silencio.
 *
 * Ninguna sirve para lo de la otra; no las unifiques. Ensanchar
 * `deriveCancellationState` con un `churned` obligaría a sus tres llamadores a
 * ramificar sobre un estado que ninguno puede encontrar.
 *
 * Basta con `status` porque `handleSubscriptionDeleted` ya separó los DOS
 * finales antes de escribir la fila: `completed` a quien cumplió su plazo,
 * `canceled` a quien se fue. Por eso ni `cancel_at_period_end` ni
 * `completed_at` pueden cambiar la respuesta — quien se gradúa las trae puestas
 * igual, y contarla como baja volvería el mejor desenlace de Aura su peor
 * métrica (ADR 0003).
 *
 * Sí, hoy es una comparación. La función existe por el NOMBRE y por lo que fija
 * su matriz de pruebas: en línea, cada `=== "canceled"` suelto es una copia que
 * se separa el día que un segundo estado terminal cuente como baja.
 */
export function isChurned(status: SubscriptionStatus): boolean {
  return status === "canceled";
}
