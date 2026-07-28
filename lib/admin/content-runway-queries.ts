import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ACCESS_STATES } from "@/lib/content/subscription-access";
import {
  contentRunway,
  RUNWAY_THRESHOLD,
  type RunwayCandidate,
  type RunwayRow,
} from "@/lib/admin/content-runway";

type RawSub = {
  id: string;
  profile_id: string;
  months_elapsed: number;
  content_variant_id: string | null;
  content_ordinal: number;
  content_loops: number;
  program_variant_id: string;
  profiles: { full_name: string } | null;
  program_variants: {
    programs: { name: string; billing_model: string; duration_months: number | null } | null;
  } | null;
};

type VariantRow = {
  id: string;
  name: string;
  ladder_next_variant_id: string | null;
};

type MapRow = { program_variant_id: string; ordinal: number };

/**
 * Las clientes a punto de quedarse sin contenido nuevo.
 *
 * Las tres lecturas son deliberadamente completas y se cruzan en memoria: el
 * catálogo son decenas de filas, no miles, y la alternativa (una consulta por
 * suscripción) es N+1 sin ganar nada.
 */
export async function getContentRunway(
  threshold: number = RUNWAY_THRESHOLD
): Promise<RunwayRow[]> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  const supabase = await createClient();

  const { data: rawSubs } = await supabase
    .from("subscriptions")
    .select(
      "id, profile_id, months_elapsed, content_variant_id, content_ordinal, content_loops, program_variant_id, profiles(full_name), program_variants!program_variant_id(programs(name, billing_model, duration_months))"
    )
    .in("status", ACCESS_STATES);

  // keep: subscriptions JOIN profiles + program_variants JOIN programs — join anidado no inferido.
  const subs = (rawSubs ?? []) as unknown as RawSub[];
  if (subs.length === 0) return [];

  const { data: rawVariants } = await supabase
    .from("program_variants")
    .select("id, name, ladder_next_variant_id");
  const variants = new Map(
    ((rawVariants ?? []) as VariantRow[]).map((v) => [v.id, v])
  );

  // Sólo cuentan las series PUBLICADAS: una serie en borrador no es contenido
  // que la cliente vaya a ver, así que tampoco es pista de aterrizaje.
  //
  // ⚠ Diverge a propósito de la regla de avance: `readCurriculum` NO filtra por
  // `published`, así que con un peldaño siguiente lleno de borradores la cliente
  // no se congela, cruza a él y se encuentra el día vacío. La señal avisa igual
  // —antes, no después— y por eso el aviso habla de series PUBLICADAS y no
  // promete que se vaya a congelar.
  const { data: rawMap } = await supabase
    .from("variant_series_map")
    .select("program_variant_id, ordinal, program_series!inner ( published )")
    .eq("program_series.published", true);

  // keep: variant_series_map JOIN program_series!inner — forma del join no inferida.
  const ordinalsByVariant = new Map<string, number[]>();
  for (const row of (rawMap ?? []) as unknown as MapRow[]) {
    const list = ordinalsByVariant.get(row.program_variant_id) ?? [];
    list.push(row.ordinal);
    ordinalsByVariant.set(row.program_variant_id, list);
  }

  const candidates: RunwayCandidate[] = [];
  for (const s of subs) {
    // Sin puntero no hay peldaño que evaluar; el lector del portal cae a la
    // variante comprada y aquí basta con no inventar una posición.
    const rungId = s.content_variant_id ?? s.program_variant_id;
    const rung = variants.get(rungId);
    const program = s.program_variants?.programs;
    if (!rung || !program) continue;

    const nextId = rung.ladder_next_variant_id;
    const next = nextId ? variants.get(nextId) : null;

    candidates.push({
      subscriptionId: s.id,
      clientId: s.profile_id,
      clientName: s.profiles?.full_name ?? "—",
      programName: program.name,
      rungName: rung.name,
      contentOrdinal: s.content_ordinal,
      contentLoops: s.content_loops,
      rungOrdinals: ordinalsByVariant.get(rungId) ?? [],
      nextRung: next
        ? { name: next.name, ordinalCount: (ordinalsByVariant.get(next.id) ?? []).length }
        : null,
      billingModel: program.billing_model,
      durationMonths: program.duration_months,
      monthsElapsed: s.months_elapsed,
    });
  }

  return contentRunway(candidates, threshold);
}
