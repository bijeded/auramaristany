// Fuente única de verdad: qué estados de suscripción conceden acceso al portal.
// Decisión de negocio (2026-06-11): active + trialing + past_due (ventana de
// gracia de Stripe; past_due muestra banner). Ampliar/reducir AQUÍ se propaga
// a middleware, getTodayContent y getPerformanceData.
export const ACCESS_STATES = ["active", "trialing", "past_due"] as const;

export function subscriptionGrantsAccess(status: string): boolean {
  return (ACCESS_STATES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------------
// L2c — el segundo nivel: portal graduado.
//
// `ACCESS_STATES` responde a UNA pregunta —¿puede recibir contenido de
// entrenamiento?— y la contesta para nueve llamadores a la vez. Meter
// `completed` ahí le serviría entrenamientos nuevos a quien ya no paga, por
// todos ellos de golpe, sin que nadie tuviera que decidirlo.
//
// Por eso el nivel graduado es un predicado APARTE y con otro nombre: quien
// terminó su programa conserva lo suyo (su cuenta, sus pagos, su historial y
// sus fotos) y pierde lo que estaba pagando. Los caminos que sirven contenido
// siguen preguntando por `subscriptionGrantsAccess`; sólo la cáscara del portal
// pregunta por esto.
// ---------------------------------------------------------------------------

/** Estados que conservan el portal sin dar contenido nuevo. */
export const GRADUATED_STATES = ["completed"] as const;

/**
 * Quién entra al portal, pague o haya terminado.
 *
 * Es un CONJUNTO y no un predicado a propósito (D18). Los tres lectores de la
 * cáscara —middleware, el layout del portal y account-queries— lo empujan a SQL
 * con `.in(...)`, así que el filtro ocurre en la base y toda fila que llega a
 * memoria ya es de la cáscara. Un predicado sobre una fila ya filtrada
 * contestaría `true` siempre: no protegería nada y, peor, se leería como el
 * hermano de `subscriptionGrantsAccess` al que también hay que preguntar.
 */
export const PORTAL_SHELL_STATES = [...ACCESS_STATES, ...GRADUATED_STATES] as const;

export function subscriptionIsGraduated(status: string): boolean {
  return (GRADUATED_STATES as readonly string[]).includes(status);
}

export type PortalTier = "paying" | "graduated" | "none";

/**
 * El nivel de una cliente a partir de TODAS sus suscripciones.
 *
 * Existe porque las filas conviven: terminar CuarentaMás y comprar Extra deja
 * dos, y quedarse con la terminada le quitaría el contenido que acaba de
 * pagar. Pagar gana siempre, venga en el orden que venga.
 */
export function derivePortalTier(statuses: readonly string[]): PortalTier {
  if (statuses.some(subscriptionGrantsAccess)) return "paying";
  if (statuses.some(subscriptionIsGraduated)) return "graduated";
  return "none";
}
