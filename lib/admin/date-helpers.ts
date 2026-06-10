export function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

export function monthLabel(key: string): string {
  const d = new Date(`${key}-01T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const s = d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
