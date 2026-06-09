import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDayKey, getCurrentSeriesNumber } from "./access";
import type { DayKey } from "./access";

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
  video_url?: string;
  metrics: string[]; // e.g. ['reps_done', 'weight_kg']
}

export interface DayBlock {
  id: string;
  block_type: "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
  sort_order: number;
  content: Record<string, unknown>;
}

export interface ProgressLog {
  id: string;
  completed: boolean;
  exercises_done: Record<string, unknown> | null;
  general_notes: string | null;
}

export interface TodayContent {
  day: {
    id: string;
    week_number: number;
    day_of_week: string;
    workout_focus: string | null;
    title: string;
    description: string | null;
    day_type: string;
    duration_minutes: number | null;
  };
  blocks: DayBlock[];
  currentDayKey: DayKey;
  monthsElapsed: number;
  programSlug: string;
  subscriptionId: string;
  existingLog: ProgressLog | null;
  effectiveDate: string; // "YYYY-MM-DD" — may differ from real date in dev
}

/**
 * Fetches everything needed to render /portal/today for the given user.
 * Returns null when the user has no active subscription, the series is not
 * mapped to their variant, or today is a rest day (no program_day row).
 */
// Raw types for complex Supabase selects (Relationships not defined in Database type)
interface SubRow {
  id: string;
  months_elapsed: number;
  current_period_start: string | null;
  program_variant_id: string;
  program_variants: { program_id: string; programs: { slug: string } };
}

interface VariantSeriesRow {
  series_id: string;
  program_series: { series_number: number };
}

interface DayRow {
  id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  description: string | null;
  day_type: string;
  duration_minutes: number | null;
}

interface BlockRow {
  id: string;
  block_type: string;
  sort_order: number;
  content: Record<string, unknown>;
}

interface LogRow {
  id: string;
  completed: boolean;
  exercises_done: Record<string, unknown> | null;
  general_notes: string | null;
}

export async function getTodayContent(
  userId: string
): Promise<TodayContent | null> {
  const supabase = await createClient();
  // T12:00:00 avoids midnight-UTC → prior-day in negative-offset timezones
  const today = process.env.DEV_DATE ? new Date(`${process.env.DEV_DATE}T12:00:00`) : new Date();

  // 1. Active subscription with program slug
  const { data: rawSub } = await supabase
    .from("subscriptions")
    .select(
      `id, months_elapsed, current_period_start, program_variant_id,
       program_variants!inner ( program_id,
         programs!inner ( slug )
       )`
    )
    .eq("profile_id", userId)
    .eq("status", "active")
    .single();

  const sub = rawSub as unknown as SubRow | null;
  if (!sub || !sub.current_period_start) return null;

  const programSlug = sub.program_variants.programs.slug;
  const seriesNumber = getCurrentSeriesNumber(sub.months_elapsed);
  const dayKey = getCurrentDayKey(sub.current_period_start, today);

  // 2. Find which series_id maps to this variant + series_number
  const { data: rawVariantSeries } = await supabase
    .from("variant_series_map")
    .select("series_id, program_series!inner ( series_number )")
    .eq("program_variant_id", sub.program_variant_id);

  const variantSeries = rawVariantSeries as unknown as VariantSeriesRow[] | null;
  const seriesEntry = variantSeries?.find(
    (m) => m.program_series.series_number === seriesNumber
  );

  if (!seriesEntry) return null;

  // 3. Fetch today's program_day
  const { data: rawDay } = await supabase
    .from("program_days")
    .select(
      "id, week_number, day_of_week, workout_focus, title, description, day_type, duration_minutes"
    )
    .eq("series_id", seriesEntry.series_id)
    .eq("week_number", dayKey.week_number)
    .eq("day_of_week", dayKey.day_of_week)
    .eq("published", true)
    .single();

  const day = rawDay as unknown as DayRow | null;
  if (!day) return null; // rest day or content not yet published

  // 4. Fetch blocks ordered by sort_order
  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("id, block_type, sort_order, content")
    .eq("day_id", day.id)
    .order("sort_order");

  const blocks = rawBlocks as unknown as BlockRow[] | null;

  // 5. Load any existing progress log for today
  const todayDate = today.toISOString().split("T")[0];
  const { data: rawLog } = await supabase
    .from("progress_logs")
    .select("id, completed, exercises_done, general_notes:notes")
    .eq("profile_id", userId)
    .eq("program_day_id", day.id)
    .eq("log_date", todayDate)
    .maybeSingle();

  const existingLog = rawLog as unknown as LogRow | null;

  return {
    day,
    blocks: (blocks ?? []) as DayBlock[],
    currentDayKey: dayKey,
    monthsElapsed: sub.months_elapsed,
    programSlug,
    subscriptionId: sub.id,
    existingLog,
    effectiveDate: today.toISOString().split("T")[0],
  };
}

/**
 * Upserts a progress log for the current day.
 * Called from the auto-save API route.
 */
export async function upsertProgressLog(params: {
  userId: string;
  subscriptionId: string;
  programDayId: string;
  exercisesDone: Record<string, unknown>;
  generalNotes: string;
  completed: boolean;
}): Promise<{ id: string } | null> {
  const supabase = await createClient();
  // Respeta DEV_DATE (igual que getTodayContent) para que el día simulado y el
  // log_date sean coherentes en desarrollo. En producción DEV_DATE no existe.
  const today = process.env.DEV_DATE
    ? new Date(`${process.env.DEV_DATE}T12:00:00`)
    : new Date();
  const logDate = today.toISOString().split("T")[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("progress_logs")
    .upsert(
      {
        profile_id: params.userId,
        subscription_id: params.subscriptionId,
        program_day_id: params.programDayId,
        log_date: logDate,
        exercises_done: params.exercisesDone,
        notes: params.generalNotes,
        completed: params.completed,
      },
      { onConflict: "profile_id,program_day_id" }
    )
    .select("id")
    .single();

  if (error) return null;
  return data;
}
