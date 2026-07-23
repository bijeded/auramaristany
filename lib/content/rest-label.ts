// A2 — Rest in minutes (presentation only; rest_seconds data is untouched)
// <60 → "45 seg" · exact minutes → "1 min" · otherwise → "1:30 min"
export function formatRestLabel(rawSeconds: number): string {
  const seconds = Number.isFinite(rawSeconds) ? Math.max(0, Math.round(rawSeconds)) : 0;
  if (seconds < 60) return `${seconds} seg`;
  const mins = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) return `${mins} min`;
  return `${mins}:${String(rest).padStart(2, "0")} min`;
}
