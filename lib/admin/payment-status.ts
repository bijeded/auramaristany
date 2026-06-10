// Etiqueta + colores por estado de invoice (Stripe: 'paid' | 'open' | 'void' | 'uncollectible').
export const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  paid: { text: "Pagado", bg: "rgba(76,175,125,.14)", color: "var(--exito)" },
  open: { text: "Pendiente", bg: "rgba(240,198,116,.18)", color: "#9a7b1f" },
  void: { text: "Anulado", bg: "var(--gris-claro)", color: "var(--gris-texto)" },
  uncollectible: { text: "Fallido", bg: "var(--error-tint)", color: "var(--error)" },
};
