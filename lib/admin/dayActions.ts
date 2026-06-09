"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
