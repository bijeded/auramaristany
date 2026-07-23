// A1 — kg/lb conversion (presentation/entry only; storage is always canonical kg)
const LB_PER_KG = 0.45359237;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function lbToKg(lb: number): number {
  return round1(lb * LB_PER_KG);
}

export function kgToLb(kg: number): number {
  return round1(kg / LB_PER_KG);
}
