// lib/content/cardio.ts
export interface CardioZone2Range {
  suelo: number | null;
  cielo: number | null;
}

/**
 * Cardio Zona 2 = 60–70% de la frecuencia cardiaca máxima estimada (220 - edad).
 * Fórmula fija; no se persiste. Devuelve enteros redondeados.
 */
export function cardioZone2(edad: number): CardioZone2Range {
  if (!Number.isFinite(edad) || edad <= 0) {
    return { suelo: null, cielo: null };
  }
  const fcMax = 220 - edad;
  // Numerador entero (x*6/10, x*7/10) para evitar errores de punto flotante
  // (p.ej. 175*0.7 = 122.4999… redondearía a 122 en vez de 123).
  return {
    suelo: Math.round((fcMax * 6) / 10),
    cielo: Math.round((fcMax * 7) / 10),
  };
}
