export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function validatePhone(raw: string): { ok: boolean; error?: string; normalized: string } {
  const normalized = normalizePhone(raw);
  if (normalized.length === 0) {
    return { ok: false, error: "Ingresa tu número de celular.", normalized };
  }
  if (normalized.length < 11 || normalized.length > 15) {
    return { ok: false, error: "Incluye la lada de país (ej. +52 55 1234 5678).", normalized };
  }
  return { ok: true, normalized };
}
