// Fuente única de verdad: qué estados de suscripción conceden acceso al portal.
// Decisión de negocio (2026-06-11): active + trialing + past_due (ventana de
// gracia de Stripe; past_due muestra banner). Ampliar/reducir AQUÍ se propaga
// a middleware, getTodayContent y getPerformanceData.
export const ACCESS_STATES = ["active", "trialing", "past_due"] as const;

export function subscriptionGrantsAccess(status: string): boolean {
  return (ACCESS_STATES as readonly string[]).includes(status);
}
