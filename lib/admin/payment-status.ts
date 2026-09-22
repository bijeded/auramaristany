import { BADGE_TONE } from "@/lib/ui/badge-tones";

// Etiqueta + colores por estado de invoice (Stripe: 'paid' | 'open' | 'void' | 'uncollectible').
// No se exporta: toda pantalla pasa por `paymentStatusBadge`, que es quien sabe
// qué hacer con un status sin entrada.
const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  paid: { text: "Pagado", ...BADGE_TONE.success },
  open: { text: "Pendiente", ...BADGE_TONE.warning },
  void: { text: "Anulado", ...BADGE_TONE.neutral },
  uncollectible: { text: "Fallido", ...BADGE_TONE.danger },
};

/**
 * D8 — la insignia de un pago, la MISMA en el listado de pagos, el dashboard,
 * la ficha y el historial del portal.
 *
 * Había cuatro búsquedas y tres salidas distintas para un status sin entrada:
 * dos caían a "Pendiente" —afirmar que una factura desconocida está por
 * cobrarse no es feo, es falso—, una a "Anulado" y la ficha tenía su propia
 * copia del mapa. Lo desconocido se muestra con su propio nombre y en neutro,
 * el mismo criterio que `statusBadge` usa para las suscripciones.
 */
export function paymentStatusBadge(status: string): { text: string; bg: string; color: string } {
  return STATUS_LABEL[status] ?? { text: status, ...BADGE_TONE.neutral };
}
