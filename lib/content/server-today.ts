import "server-only";

/**
 * "Hoy" según el servidor, respetando la override de desarrollo `DEV_DATE`.
 *
 * Fuente única: antes esta expresión estaba duplicada en 8 sitios (queries de
 * contenido, reservas, portal y admin). Cualquier divergencia entre ellos hace
 * que el día simulado y el `log_date` dejen de coincidir en desarrollo (D9).
 *
 * `DEV_DATE` se ancla al **mediodía** local a propósito: a medianoche UTC, una
 * zona con offset negativo (México) cae en el día anterior y todo el cálculo de
 * semana/día se corre uno (misma razón que en getTodayContent).
 *
 * ⚠ La override se ignora por completo en producción, no sólo por convención.
 * `DEV_DATE` es una variable de entorno normal: nada impide ponerla por error
 * en Vercel, y ahí congelaría el "hoy" de toda la plataforma — contenido del
 * día equivocado, `progress_logs.log_date` escrito con la fecha congelada y,
 * con A4, `period_key`s que nunca avanzan (los avisos automáticos quedarían
 * suprimidos o repitiéndose para siempre). El gate hace que un despiste de
 * configuración no pueda tener ese efecto.
 *
 * Un `DEV_DATE` vacío o malformado se degrada al reloj real (con aviso) en vez
 * de propagar un `Invalid Date` a los cálculos de día del portal: un throw
 * tumbaría todas las páginas server por una errata.
 */
export function serverToday(): Date {
  const devDate = process.env.DEV_DATE;
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  if (devDate && !isProduction) {
    const simulated = new Date(`${devDate}T12:00:00`);
    if (!Number.isNaN(simulated.getTime())) return simulated;
    console.warn("[serverToday] DEV_DATE inválida, se usa el reloj real:", devDate);
  }
  return new Date();
}
