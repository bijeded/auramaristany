/**
 * Quién está a punto de quedarse sin contenido nuevo.
 *
 * Sin esta señal, Aura se entera de que a una cliente se le acabó el programa
 * porque la cliente se queja. Las dos formas de agotarse tienen la misma causa
 * y el mismo remedio —hay que escribir más contenido— así que salen en una sola
 * lista:
 *
 *   - `will_repeat`: está terminando el último peldaño y va a volver a empezar.
 *   - `next_rung_empty`: está terminando un peldaño cuyo siguiente está
 *     declarado pero vacío. Es el urgente: la regla de avance la CONGELA ahí
 *     (rama 5 de `advanceLadderPosition`), así que se queda pagando sin
 *     contenido nuevo hasta que exista la primera serie del peldaño siguiente.
 *
 * Función pura: no consulta la base de datos.
 */

/** Posiciones que le pueden quedar por delante antes de avisar. */
export const RUNWAY_THRESHOLD = 2;

export interface RunwayCandidate {
  subscriptionId: string;
  clientId: string;
  clientName: string;
  programName: string;
  /** Nombre de la variante del puntero (`content_variant_id`). */
  rungName: string;
  contentOrdinal: number;
  contentLoops: number;
  /** Ordinales publicados del peldaño actual. */
  rungOrdinals: number[];
  /** El peldaño declarado en `ladder_next_variant_id`, o `null` si es el último. */
  nextRung: { name: string; ordinalCount: number } | null;
  billingModel: string;
  durationMonths: number | null;
  monthsElapsed: number;
}

export interface RunwayRow {
  subscriptionId: string;
  clientId: string;
  clientName: string;
  programName: string;
  rungName: string;
  contentOrdinal: number;
  contentLoops: number;
  /** Posiciones que existen por encima de la suya en este peldaño. */
  remaining: number;
  kind: "next_rung_empty" | "will_repeat";
  nextRungName: string | null;
}

export function contentRunway(
  candidates: RunwayCandidate[],
  threshold: number = RUNWAY_THRESHOLD
): RunwayRow[] {
  const rows: RunwayRow[] = [];

  for (const c of candidates) {
    // Un plazo fijo termina: ni da la vuelta ni cruza de peldaño, así que no
    // tiene forma de quedarse sin contenido.
    if (c.billingModel === "fixed_term_monthly" && c.durationMonths) continue;

    // Lo que le queda son las posiciones que EXISTEN por encima, no la resta de
    // ordinales: un hueco en la numeración no es contenido.
    const remaining = c.rungOrdinals.filter((o) => o > c.contentOrdinal).length;
    if (remaining > threshold) continue;

    // Si el peldaño siguiente ya tiene series, ahí va a entrar y no se le acaba
    // nada. Sólo preocupa el que está declarado y vacío.
    let kind: RunwayRow["kind"];
    if (c.nextRung) {
      if (c.nextRung.ordinalCount > 0) continue;
      kind = "next_rung_empty";
    } else {
      kind = "will_repeat";
    }

    rows.push({
      subscriptionId: c.subscriptionId,
      clientId: c.clientId,
      clientName: c.clientName,
      programName: c.programName,
      rungName: c.rungName,
      contentOrdinal: c.contentOrdinal,
      contentLoops: c.contentLoops,
      remaining,
      kind,
      nextRungName: c.nextRung?.name ?? null,
    });
  }

  return rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "next_rung_empty" ? -1 : 1;
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return a.clientName.localeCompare(b.clientName, "es");
  });
}
