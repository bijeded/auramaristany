/**
 * El currículo de una variante: las series mapeadas a ella, cada una en su
 * posición (`variant_series_map.ordinal`). La posición vive en el mapeo, no en
 * la serie, así que una misma serie puede ser el Mes 1 de una variante y el
 * Mes 4 de otra.
 *
 * Estas funciones son puras: no consultan la base de datos. Reciben el
 * currículo ya leído y responden dónde está y hacia dónde sigue una cliente.
 */

/**
 * Una posición del currículo de una variante.
 *
 * Precondición: dentro de un mismo currículo `ordinal` es único. Lo garantiza
 * `unique(program_variant_id, ordinal)` en la base de datos, NO estas funciones
 * — si alguna vez se construyen estas entradas desde otra fuente, la unicidad
 * es una suposición, no una validación.
 */
export interface CurriculumEntry {
  ordinal: number;
  series_id: string;
}

/** La posición más baja que cumple `matches`, o `null` si ninguna lo hace. */
function lowestOrdinal(
  entries: CurriculumEntry[],
  matches: (ordinal: number) => boolean
): number | null {
  let lowest: number | null = null;
  for (const entry of entries) {
    if (!matches(entry.ordinal)) continue;
    if (lowest === null || entry.ordinal < lowest) lowest = entry.ordinal;
  }
  return lowest;
}

/**
 * La primera posición del currículo, o `null` si no hay ninguna.
 *
 * No se asume que sea 1: es la más baja de las que existen.
 */
export function firstOrdinal(entries: CurriculumEntry[]): number | null {
  return lowestOrdinal(entries, () => true);
}

/**
 * La posición siguiente a `current`: la **más baja de las que existen por
 * encima**, o `null` si no hay ninguna (fin del currículo).
 *
 * ⚠ Deliberadamente NO es `current + 1`. `unique(program_variant_id, ordinal)`
 * impide posiciones duplicadas pero no huecos, y borrar un mapeo intermedio
 * deja 1,2,4,5,6. Con `current + 1` la posición 3 no existe, el lector concluye
 * "se acabó el nivel" y adelanta a la cliente al siguiente nivel meses antes.
 * Con esta regla un hueco es sólo una rareza de numeración.
 *
 * Que `current` exista o no en el currículo es indiferente: si Aura borró el
 * mapeo donde estaba una cliente, ésta avanza a la siguiente que sí existe en
 * lugar de quedarse encallada.
 */
export function nextOrdinal(
  entries: CurriculumEntry[],
  current: number
): number | null {
  return lowestOrdinal(entries, (ordinal) => ordinal > current);
}

/** La serie en una posición concreta, o `null` si esa posición no existe. */
export function seriesAtOrdinal(
  entries: CurriculumEntry[],
  ordinal: number
): string | null {
  return entries.find((entry) => entry.ordinal === ordinal)?.series_id ?? null;
}
