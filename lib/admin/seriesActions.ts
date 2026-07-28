"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";

/**
 * Una posición concreta: qué variante muestra la serie y en qué mes.
 *
 * Es por FILA, no por serie. Una misma serie puede ser el Mes 1 de una variante
 * y el Mes 4 de otra, así que un único `ordinal` para toda la serie reescribiría
 * la posición de las demás variantes sin que el admin lo pida.
 */
export interface SeriesMappingInput {
  variantId: string;
  ordinal: number;
}

export interface CreateSeriesInput {
  title: string;
  description?: string | null;
  mappings: SeriesMappingInput[];
}

export interface UpdateSeriesInput {
  title: string;
  description?: string | null;
  published: boolean;
  mappings: SeriesMappingInput[];
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 1000;

// `months_elapsed` arranca en 1, así que un Mes 0 sería contenido que ninguna
// cliente puede alcanzar nunca. La columna en la BD es `int` a secas.
const mappingSchema = z.object({
  variantId: z.string().uuid(),
  ordinal: z.number().int().min(1).max(240),
});

const baseSchema = {
  title: z.string().trim().min(1).max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().optional(),
  mappings: z.array(mappingSchema).min(1),
};

const createSchema = z.object(baseSchema);
const updateSchema = z.object({ ...baseSchema, published: z.boolean() });

/**
 * 23505 sobre `variant_series_map` = esa variante ya tiene una serie en esa
 * posición. Ya NO puede venir de `program_series`: el mes es único por
 * variante, no por programa, que es justo lo que este cambio arregla.
 */
function positionTakenMessage(mappings: SeriesMappingInput[]): string {
  const months = Array.from(new Set(mappings.map((m) => m.ordinal))).sort((a, b) => a - b);
  return months.length === 1
    ? `Ya existe un Mes ${months[0]} en alguna de las variantes elegidas.`
    : `Alguna de las variantes elegidas ya tiene ocupado uno de esos meses.`;
}

function toRows(seriesId: string, mappings: SeriesMappingInput[]) {
  return mappings.map((m) => ({
    program_variant_id: m.variantId,
    series_id: seriesId,
    ordinal: m.ordinal,
  }));
}

export async function createSeries(
  programId: string,
  data: CreateSeriesInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  // Sin variante la serie no tiene posición: no es que quede inalcanzable, es
  // que no se puede representar en ningún currículo.
  const parsed = createSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Revisa los datos de la serie: falta el título o la variante." };
  }
  const input = parsed.data;
  const supabase = auth.supabase;

  const { data: newSeries, error: seriesError } = await supabase
    .from("program_series")
    .insert({
      program_id: programId,
      title: input.title,
      description: input.description ?? null,
      published: false,
    })
    .select("id")
    .single();

  if (seriesError) {
    return { error: logAndGeneric("createSeries.insert", seriesError) };
  }

  const seriesId = (newSeries as { id: string }).id;
  const { error: mapError } = await supabase
    .from("variant_series_map")
    .insert(toRows(seriesId, input.mappings));

  if (mapError) {
    // La serie ya se insertó; sin mapeo queda huérfana e invisible. Se borra
    // para no dejar basura que el admin no puede ver ni eliminar.
    const { error: rollbackError } = await supabase
      .from("program_series")
      .delete()
      .eq("id", seriesId);
    if (rollbackError) logAndGeneric("createSeries.rollback", rollbackError);

    if ((mapError as { code?: string }).code === "23505") {
      return { error: positionTakenMessage(input.mappings) };
    }
    return { error: logAndGeneric("createSeries.map", mapError) };
  }

  revalidatePath(`/admin/content/${programId}`);
  return {};
}

export async function updateSeries(
  seriesId: string,
  programId: string,
  data: UpdateSeriesInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Revisa los datos de la serie: falta el título o la variante." };
  }
  const input = parsed.data;
  const supabase = auth.supabase;

  const { error: updateError } = await supabase
    .from("program_series")
    .update({
      title: input.title,
      description: input.description ?? null,
      published: input.published,
    })
    .eq("id", seriesId);

  if (updateError) return { error: logAndGeneric("updateSeries.update", updateError) };

  // Reconciliación borrar-e-insertar: NO es atómica. Se leen los mapeos actuales
  // antes de borrar para poder restaurarlos si la inserción falla — sin eso, un
  // 23505 (posición ocupada, un error que el admin provoca a diario) dejaría la
  // serie mapeada a CERO variantes: invisible en todos los currículos e
  // irrecuperable desde el editor. Misma familia que D2 (saveBlocks).
  const { data: rawPrevious, error: readError } = await supabase
    .from("variant_series_map")
    .select("program_variant_id, series_id, ordinal")
    .eq("series_id", seriesId);

  if (readError) return { error: logAndGeneric("updateSeries.readMap", readError) };
  const previous = (rawPrevious ?? []) as {
    program_variant_id: string;
    series_id: string;
    ordinal: number;
  }[];

  const { error: deleteMapError } = await supabase
    .from("variant_series_map")
    .delete()
    .eq("series_id", seriesId);

  if (deleteMapError) return { error: logAndGeneric("updateSeries.deleteMap", deleteMapError) };

  const { error: insertMapError } = await supabase
    .from("variant_series_map")
    .insert(toRows(seriesId, input.mappings));

  if (insertMapError) {
    if (previous.length > 0) {
      const { error: restoreError } = await supabase
        .from("variant_series_map")
        .insert(previous);
      if (restoreError) logAndGeneric("updateSeries.restoreMap", restoreError);
    }
    if ((insertMapError as { code?: string }).code === "23505") {
      return { error: positionTakenMessage(input.mappings) };
    }
    return { error: logAndGeneric("updateSeries.insertMap", insertMapError) };
  }

  revalidatePath(`/admin/content/${programId}`);
  return {};
}

export async function deleteSeries(
  seriesId: string,
  programId: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;

  const { error: mapError } = await supabase
    .from("variant_series_map")
    .delete()
    .eq("series_id", seriesId);

  if (mapError) return { error: logAndGeneric("deleteSeries.deleteMap", mapError) };

  const { error } = await supabase
    .from("program_series")
    .delete()
    .eq("id", seriesId);

  if (error) return { error: logAndGeneric("deleteSeries.delete", error) };

  revalidatePath(`/admin/content/${programId}`);
  return {};
}
