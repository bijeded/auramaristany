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
