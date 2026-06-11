"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";

export interface SaveDayInput {
  id?: string;
  seriesId: string;
  weekNumber: number;
  dayOfWeek: string;
  title: string;
  workoutFocus: string | null;
  dayType: "workout" | "rest" | "cardio";
  durationMinutes: number | null;
  published: boolean;
}

export async function saveDay(data: SaveDayInput): Promise<{ dayId: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { dayId: data.id ?? "", error: auth.error };
  const supabase = auth.supabase;
  const row = {
    series_id: data.seriesId,
    week_number: data.weekNumber,
    day_of_week: data.dayOfWeek,
    title: data.title,
    workout_focus: data.workoutFocus,
    day_type: data.dayType,
    duration_minutes: data.durationMinutes,
    published: data.published,
  };

  if (data.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from("program_days").update(row).eq("id", data.id).select("id").single();
    if (error) return { dayId: data.id, error: error.message };
    return { dayId: updated.id };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (supabase as any)
    .from("program_days").insert(row).select("id").single();
  if (error) return { dayId: "", error: error.message };
  return { dayId: inserted.id };
}

export interface SaveBlockInput {
  block_type: string;
  content: Record<string, unknown>;
}

export async function saveBlocks(dayId: string, blocks: SaveBlockInput[]): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const { error: delError } = await client.from("program_day_blocks").delete().eq("day_id", dayId);
  if (delError) return { error: delError.message };

  if (blocks.length > 0) {
    const rows = blocks.map((b, i) => ({
      day_id: dayId,
      block_type: b.block_type,
      sort_order: i,
      content: b.content,
    }));
    const { error: insError } = await client.from("program_day_blocks").insert(rows);
    if (insError) return { error: insError.message };
  }

  revalidatePath("/portal/today");
  return {};
}

export async function deleteDay(dayId: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error: blockErr } = await client.from("program_day_blocks").delete().eq("day_id", dayId);
  if (blockErr) return { error: blockErr.message };
  const { error } = await client.from("program_days").delete().eq("id", dayId);
  if (error) return { error: error.message };
  revalidatePath("/admin/content");
  return {};
}

export async function cloneDay(
  sourceDayId: string,
  target: { seriesId: string; weekNumber: number; dayOfWeek: string },
  overwrite: boolean
): Promise<{ dayId?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // 1. Leer el día origen + sus bloques
  const { data: src } = await client.from("program_days")
    .select("week_number, day_of_week, workout_focus, title, description, day_type, duration_minutes, published")
    .eq("id", sourceDayId).single();
  if (!src) return { error: "Día origen no encontrado" };

  const { data: srcBlocks } = await client.from("program_day_blocks")
    .select("block_type, sort_order, content").eq("day_id", sourceDayId).order("sort_order");

  // 2. ¿Existe ya un día en la celda destino?
  const { data: existing } = await client.from("program_days")
    .select("id").eq("series_id", target.seriesId)
    .eq("week_number", target.weekNumber).eq("day_of_week", target.dayOfWeek).maybeSingle();

  if (existing && !overwrite) return { error: "La celda destino ya tiene un día" };
  if (existing) { await deleteDay(existing.id); }

  // 3. Insertar el día clonado
  const { data: newDay, error } = await client.from("program_days").insert({
    series_id: target.seriesId,
    week_number: target.weekNumber,
    day_of_week: target.dayOfWeek,
    workout_focus: src.workout_focus,
    title: src.title,
    description: src.description,
    day_type: src.day_type,
    duration_minutes: src.duration_minutes,
    published: src.published,
  }).select("id").single();
  if (error) return { error: error.message };

  // 4. Clonar bloques
  if (srcBlocks && srcBlocks.length > 0) {
    await client.from("program_day_blocks").insert(
      srcBlocks.map((b: { block_type: string; sort_order: number; content: unknown }) => ({
        day_id: newDay.id, block_type: b.block_type, sort_order: b.sort_order, content: b.content,
      }))
    );
  }
  revalidatePath("/admin/content");
  return { dayId: newDay.id };
}

export async function cloneWeek(
  seriesId: string, sourceWeek: number, targetWeek: number, overwrite: boolean
): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: days } = await (supabase as any).from("program_days")
    .select("id, day_of_week").eq("series_id", seriesId).eq("week_number", sourceWeek);
  if (!days || days.length === 0) return { error: "La semana origen no tiene días" };

  for (const d of days as { id: string; day_of_week: string }[]) {
    const res = await cloneDay(d.id, { seriesId, weekNumber: targetWeek, dayOfWeek: d.day_of_week }, overwrite);
    if (res.error) return { error: res.error };
  }
  return {};
}
