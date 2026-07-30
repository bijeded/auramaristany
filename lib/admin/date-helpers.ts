export function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

export function monthLabel(key: string): string {
  const d = new Date(`${key}-01T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dayLabel(iso: string): string {
  // Split on "T" to tolerate both date-only ("2026-06-08") and
  // full ISO strings from timestamptz columns ("2026-06-08T04:00:00+00:00").
  const d = new Date(`${iso.split("T")[0]}T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Días completos transcurridos entre dos fechas date-only, en UTC (evita desfase
 * de zona horaria — lección EDGE-3). Ignora la parte de hora si viene un ISO completo.
 */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toISO.slice(0, 10)}T00:00:00Z`);
  return Math.floor((to - from) / 86_400_000);
}

/**
 * "hoy" · "ayer" · "hace N días" — la RECENCIA de una fecha respecto a `now`.
 *
 * `now` es un parámetro y no `Date.now()` a propósito: el mismo `now` que ya
 * recibe la tabla desde el servidor (`serverToday()`, DEV_DATE-aware) y que usa
 * `isInactive`. Leyendo el reloj del navegador, la etiqueta y el marcado de
 * inactividad podrían discrepar en cuanto la zona del navegador no coincidiera
 * con el "hoy" date-only del servidor — el mismo dato contándose dos veces.
 *
 * "ayer" no es cosmético: la forma genérica diría "hace 1 días".
 */
export function relativeDayLabel(iso: string, now: string): string {
  const days = daysBetween(iso, now);
  // Una fecha futura sólo puede venir de un dato adelantado; "hace -3 días"
  // sería peor que redondear a hoy.
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

/** "Lunes, 8 de junio" — sin año, capitalizado. Usado en /portal/pilares y TodayView.
 *  Defaults to today when `iso` is omitted (TodayView passes undefined when content is null). */
export function weekdayLabel(iso?: string): string {
  const date = iso ? new Date(`${iso.split("T")[0]}T12:00:00`) : new Date();
  const s = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "8 de junio de 2026" — con año. Usado en SubscriptionCard. */
export function longDateLabel(iso: string): string {
  return new Date(`${iso.split("T")[0]}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  });
}
