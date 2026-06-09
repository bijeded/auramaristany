import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AdminProgram {
  id: string;
  slug: string;
  name: string;
  billing_model: string;
  duration_months: number | null;
  is_active: boolean;
  series_count: number;
}

export interface AdminDay {
  id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  day_type: string;
  published: boolean;
}

export interface AdminSeries {
  id: string;
  series_number: number;
  title: string;
  description: string | null;
  published: boolean;
  days: AdminDay[];
}

export async function getAdminPrograms(): Promise<AdminProgram[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("id, slug, name, billing_model, duration_months, is_active")
    .order("name");

  if (!data) return [];

  // Count series per program
  const { data: counts } = await supabase
    .from("program_series")
    .select("program_id");

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    const r = row as unknown as { program_id: string };
    countMap[r.program_id] = (countMap[r.program_id] ?? 0) + 1;
  }

  return (data as unknown as Omit<AdminProgram, "series_count">[]).map((p) => ({
    ...p,
    series_count: countMap[p.id] ?? 0,
  }));
}

export async function getAdminProgram(programId: string) {
  const supabase = await createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, slug, name, billing_model, duration_months, is_active")
    .eq("id", programId)
    .single();

  if (!program) return null;

  const { data: rawSeries } = await supabase
    .from("program_series")
    .select(
      "id, series_number, title, description, published, program_days(id, week_number, day_of_week, workout_focus, title, day_type, published)"
    )
    .eq("program_id", programId)
    .order("series_number");

  type RawSeries = Omit<AdminSeries, "days"> & {
    program_days: AdminDay[];
  };

  const series: AdminSeries[] = ((rawSeries ?? []) as unknown as RawSeries[]).map((s) => ({
    id: s.id,
    series_number: s.series_number,
    title: s.title,
    description: s.description,
    published: s.published,
    days: s.program_days ?? [],
  }));

  return { program: program as unknown as Omit<AdminProgram, "series_count">, series };
}

export interface BlockData {
  id: string;
  block_type: "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
  sort_order: number;
  content: Record<string, unknown>;
}

export interface DayWithBlocks {
  id: string;
  series_id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  description: string | null;
  day_type: string;
  duration_minutes: number | null;
  published: boolean;
  blocks: BlockData[];
}

export async function getDayWithBlocks(dayId: string): Promise<DayWithBlocks | null> {
  const supabase = await createClient();

  const { data: rawDay } = await supabase
    .from("program_days")
    .select(
      "id, series_id, week_number, day_of_week, workout_focus, title, description, day_type, duration_minutes, published"
    )
    .eq("id", dayId)
    .single();

  const day = rawDay as unknown as Omit<DayWithBlocks, "blocks"> | null;
  if (!day) return null;

  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("id, block_type, sort_order, content")
    .eq("day_id", dayId)
    .order("sort_order");

  return { ...day, blocks: (rawBlocks as unknown as BlockData[]) ?? [] };
}
