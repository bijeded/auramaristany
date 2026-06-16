"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import { logAndGeneric } from "./errors";

export interface CreateSeriesInput {
  series_number: number;
  title: string;
  description?: string | null;
  variantIds: string[];
}

export interface UpdateSeriesInput {
  title: string;
  description?: string | null;
  published: boolean;
  variantIds: string[];
}

export async function createSeries(
  programId: string,
  data: CreateSeriesInput
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: newSeries, error: seriesError } = await supabase
    .from("program_series")
    .insert({
      program_id: programId,
      series_number: data.series_number,
      title: data.title,
      description: data.description ?? null,
      published: false,
    })
    .select("id")
    .single();

  if (seriesError) {
    if ((seriesError as { code?: string }).code === "23505") {
      return { error: `El mes ${data.series_number} ya existe en este programa` };
    }
    return { error: logAndGeneric("createSeries.insert", seriesError) };
  }

  if (data.variantIds.length > 0) {
    const mappings = data.variantIds.map((vid) => ({
      program_variant_id: vid,
      series_id: (newSeries as { id: string }).id,
    }));
    const { error: mapError } = await supabase
      .from("variant_series_map")
      .insert(mappings);
    if (mapError) return { error: logAndGeneric("createSeries.map", mapError) };
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

  if (data.variantIds.length > 0) {
    const mappings = data.variantIds.map((vid) => ({
      program_variant_id: vid,
      series_id: seriesId,
    }));
    const { error: insertMapError } = await supabase
      .from("variant_series_map")
      .insert(mappings);
    if (insertMapError) return { error: logAndGeneric("updateSeries.insertMap", insertMapError) };
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
