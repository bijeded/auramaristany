// A14 — Target volume label (presentation only; sets/reps data is untouched).
// "4 series × 12 repeticiones" · "4 series × 10 a 12 repeticiones"
//
// `sets` is a number but `reps` is free text Aura types in the block editor, so
// the noun is appended only when the value is a repetition count — a number or a
// range. Anything else keeps the unit-less form rather than asserting a unit the
// value does not carry ("4 series × 30 seg", never "× 30 seg repeticiones").
const REP_COUNT = /^\d+(\s*(?:a|-|–)\s*\d+)?$/i;

export function formatSetsReps(sets: number, reps: string): string {
  const value = reps.trim();
  const base = `${sets} series`;
  if (!value) return base;
  if (REP_COUNT.test(value)) return `${base} × ${value} repeticiones`;
  return `${base} × ${value}`;
}
