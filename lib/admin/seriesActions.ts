"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";

export interface CreateSeriesInput {
  /** Posición dentro del currículo de cada variante elegida. */
  ordinal: number;
  title: string;
  description?: string | null;
  variantIds: string[];
}

export interface UpdateSeriesInput {
  ordinal: number;
  title: string;
  description?: string | null;
  published: boolean;
  variantIds: string[];
}

/**
 * 23505 sobre `variant_series_map` = esa variante ya tiene una serie en esa
 * posición. Ya NO puede venir de `program_series`: el mes es único por
 * variante, no por programa, que es justo lo que este cambio arregla.
 */
function positionTakenMessage(ordinal: number): string {
  return `Ya existe un Mes ${ordinal} en alguna de las variantes elegidas.`;
}

export async function createSeries(
  programId: string,
  data: CreateSeriesInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  // Sin variante la serie no tiene posición: no es que quede inalcanzable, es
  // que no se puede representar en ningún currículo.
  if (data.variantIds.length === 0) {
    return { error: "Elige al menos una variante para esta serie." };
  }
  const supabase = auth.supabase;

  const { data: newSeries, error: seriesError } = await supabase
    .from("program_series")
    .insert({
      program_id: programId,
      title: data.title,
      description: data.description ?? null,
      published: false,
    })
    .select("id")
    .single();

  if (seriesError) {
    return { error: logAndGeneric("createSeries.insert", seriesError) };
  }

  const seriesId = (newSeries as { id: string }).id;
  const mappings = data.variantIds.map((vid) => ({
    program_variant_id: vid,
    series_id: seriesId,
    ordinal: data.ordinal,
  }));
  const { error: mapError } = await supabase
    .from("variant_series_map")
    .insert(mappings);

  if (mapError) {
    // La serie ya se insertó; sin mapeo queda huérfana e invisible. Se borra
    // para no dejar basura que el admin no puede ver ni eliminar.
    await supabase.from("program_series").delete().eq("id", seriesId);
    if ((mapError as { code?: string }).code === "23505") {
      return { error: positionTakenMessage(data.ordinal) };
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
  if (data.variantIds.length === 0) {
    return { error: "La serie debe tener al menos una variante." };
  }
  const supabase = auth.supabase;

  const { error: updateError } = await supabase
    .from("program_series")
    .update({
      title: data.title,
      description: data.description ?? null,
      published: data.published,
    })
    .eq("id", seriesId);

  if (updateError) return { error: logAndGeneric("updateSeries.update", updateError) };

  const { error: deleteMapError } = await supabase
    .from("variant_series_map")
    .delete()
    .eq("series_id", seriesId);

  if (deleteMapError) return { error: logAndGeneric("updateSeries.deleteMap", deleteMapError) };

  const mappings = data.variantIds.map((vid) => ({
    program_variant_id: vid,
    series_id: seriesId,
    ordinal: data.ordinal,
  }));
  const { error: insertMapError } = await supabase
    .from("variant_series_map")
    .insert(mappings);
  if (insertMapError) {
    if ((insertMapError as { code?: string }).code === "23505") {
      return { error: positionTakenMessage(data.ordinal) };
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
