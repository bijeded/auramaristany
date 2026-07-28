/**
 * Cómo se le cuenta a una cliente dónde va.
 *
 * Un programa de plazo fijo tiene final, así que su progreso es una fracción:
 * "Mes 3 de 6", con barra. Uno rolling no lo tiene, y contar meses
 * transcurridos ("Mes 14") no le dice nada a nadie: lo que importa es en qué
 * peldaño está y en qué posición dentro de él ("Avanzado · Mes 2"). Por eso el
 * rolling se etiqueta con el puntero de contenido y el plazo fijo con
 * `months_elapsed`, que es el que mide de verdad lo que dura el programa.
 *
 * Funciones puras: no consultan la base de datos.
 */

export interface ContentProgressInput {
  billingModel: string;
  durationMonths: number | null;
  /** El tiempo cobrado. Sólo lo usa la etiqueta de plazo fijo. */
  monthsElapsed: number;
  /** El nombre de la variante del puntero (`content_variant_id`), no la comprada. */
  rungName: string | null;
  contentOrdinal: number;
  contentLoops: number;
}

export interface ContentProgress {
  text: string;
  /** `null` cuando no hay final contra el que medir: no se dibuja barra. */
  percent: number | null;
}

export function contentProgressLabel(input: ContentProgressInput): ContentProgress {
  const { billingModel, durationMonths, monthsElapsed } = input;

  if (billingModel === "fixed_term_monthly" && durationMonths && durationMonths > 0) {
    return {
      text: `Mes ${monthsElapsed} de ${durationMonths}`,
      percent: Math.min(100, Math.round((monthsElapsed / durationMonths) * 100)),
    };
  }

  const position = `Mes ${input.contentOrdinal}`;
  return {
    text: input.rungName ? `${input.rungName} · ${position}` : position,
    percent: null,
  };
}

/**
 * El aviso de repetición, o `null` si todavía no ha dado ninguna vuelta.
 *
 * Es persistente a propósito, no un aviso que se cierra: una cliente que
 * reconoce el contenido y no ve explicación concluye que la app está rota.
 */
export function repeatMarker(
  contentLoops: number,
  contentOrdinal: number
): string | null {
  if (contentLoops <= 0) return null;
  return `Repitiendo Mes ${contentOrdinal}`;
}
