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
 * ⚠ `DEV_DATE` es sólo para desarrollo (gitignored, NUNCA en Vercel). Si llega
 * vacía o malformada se degrada al reloj real en lugar de propagar un
 * `Invalid Date` a los cálculos de día del portal.
 */
export function serverToday(): Date {
  const devDate = process.env.DEV_DATE;
  if (devDate) {
    const simulated = new Date(`${devDate}T12:00:00`);
    if (!Number.isNaN(simulated.getTime())) return simulated;
  }
  return new Date();
}
