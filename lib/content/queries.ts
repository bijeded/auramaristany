import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentDayKey,
  getCurrentSeriesNumber,
  getUpcomingDayKeys,
} from "./access";
import { ACCESS_STATES } from "./subscription-access";
import { serverToday } from "./server-today";
import type { DayKey, UpcomingDayKey } from "./access";
import { seriesAtOrdinal, type CurriculumEntry } from "./curriculum";
import type { Json } from "@/lib/supabase/types";

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
  block_type: "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2" | "agendar";
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

// La posición vive en el mapeo (`variant_series_map.ordinal`), así que ya no
// hace falta unir con `program_series` para resolver el mes.
type VariantSeriesRow = CurriculumEntry;

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
  const today = serverToday();

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
    .in("status", ACCESS_STATES)
    .single();

  // keep: subscriptions JOIN program_variants!inner JOIN programs!inner — Supabase SDK
  // returns `never` for nested join shape without Relationships in Database type.
  const sub = rawSub as SubRow | null;
  if (!sub || !sub.current_period_start) return null;

  const programSlug = sub.program_variants.programs.slug;
  const seriesNumber = getCurrentSeriesNumber(sub.months_elapsed);
  const dayKey = getCurrentDayKey(sub.current_period_start, today);

  // 2. Qué serie PUBLICADA ocupa esa posición en el currículo de ESTA variante.
  //
  // El filtro por `program_series.published` es explícito a propósito. Antes lo
  // hacía de rebote el join `program_series!inner`: la policy
  // `program_series_read_published` (001:352) oculta las series sin publicar a
  // las clientes, así que PostgREST descartaba la fila entera del mapeo. Al
  // resolver por `ordinal` ese join dejó de hacer falta — y con él se perdía la
  // única barrera que impedía servir una serie en borrador. Depender de un
  // efecto colateral de RLS para una regla de negocio es justo lo que lo hizo
  // invisible; aquí se dice en voz alta.
  const { data: rawVariantSeries } = await supabase
    .from("variant_series_map")
    .select("series_id, ordinal, program_series!inner ( published )")
    .eq("program_variant_id", sub.program_variant_id)
    .eq("program_series.published", true);

  // keep: variant_series_map JOIN program_series!inner — forma del join no inferida.
  const variantSeries = (rawVariantSeries ?? []) as unknown as VariantSeriesRow[];
  const seriesId = seriesAtOrdinal(variantSeries, seriesNumber);

  if (!seriesId) return null;

  // 3. Fetch today's program_day
  const { data: rawDay } = await supabase
    .from("program_days")
    .select(
      "id, week_number, day_of_week, workout_focus, title, description, day_type, duration_minutes"
    )
    .eq("series_id", seriesId)
    .eq("week_number", dayKey.week_number)
    .eq("day_of_week", dayKey.day_of_week)
    .eq("published", true)
    .single();

  // SDK types the simple select; cast to DayRow to align with the local interface.
  const day = rawDay as DayRow | null;
  if (!day) return null; // rest day or content not yet published

  // 4. Fetch blocks ordered by sort_order
  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("id, block_type, sort_order, content")
    .eq("day_id", day.id)
    .order("sort_order");

  // SDK types the simple select; cast to BlockRow[] to align with the local interface.
  const blocks = rawBlocks as BlockRow[] | null;

  // 5. Load any existing progress log for today
  const todayDate = today.toISOString().split("T")[0];
  const { data: rawLog } = await supabase
    .from("progress_logs")
    .select("id, completed, exercises_done, general_notes:notes")
    .eq("profile_id", userId)
    .eq("program_day_id", day.id)
    .eq("log_date", todayDate)
    .maybeSingle();

  // SDK types the aliased select (general_notes:notes); cast to LogRow to align.
  const existingLog = rawLog as LogRow | null;

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

// --- Calendario "Semana" (A12) ---

export interface WeekCalendarRow {
  date: string; // "YYYY-MM-DD"
  day_of_week: string;
  isToday: boolean;
  /** null = día de descanso (sin program_day para esa clave) */
  title: string | null;
  day_type: string | null;
  workout_focus: string | null;
}

interface WeekDayRow {
  week_number: number;
  day_of_week: string;
  title: string;
  day_type: string;
  workout_focus: string | null;
}

/**
 * Filas del calendario de 7 días (/portal/semana): hoy + próximos 7 días,
 * recortado al periodo actual. Solo títulos/metadata — nunca bloques ni ids
 * (los días futuros no son navegables). A diferencia de getTodayContent,
 * NO filtra por `published` (decisión A12: el calendario muestra días sin
 * publicar; /portal/today conserva su filtro).
 */
export async function getWeekCalendar(
  userId: string
): Promise<WeekCalendarRow[] | null> {
  const supabase = await createClient();
  const today = serverToday();

  const { data: rawSub } = await supabase
    .from("subscriptions")
    .select(
      `id, months_elapsed, current_period_start, current_period_end, program_variant_id`
    )
    .eq("profile_id", userId)
    .in("status", ACCESS_STATES)
    .single();

  const sub = rawSub as
    | (Pick<SubRow, "id" | "months_elapsed" | "current_period_start" | "program_variant_id"> & {
        current_period_end: string | null;
      })
    | null;
  if (!sub || !sub.current_period_start) return null;

  const dayKeys = getUpcomingDayKeys(
    sub.current_period_start,
    sub.current_period_end,
    today
  );
  if (dayKeys.length === 0) return [];

  const seriesNumber = getCurrentSeriesNumber(sub.months_elapsed);
  // Mismo filtro explícito que en getTodayContent, y aquí importa más: este
  // calendario NO filtra `program_days.published` (decisión A12), así que la
  // serie era su único control de publicación.
  const { data: rawVariantSeries } = await supabase
    .from("variant_series_map")
    .select("series_id, ordinal, program_series!inner ( published )")
    .eq("program_variant_id", sub.program_variant_id)
    .eq("program_series.published", true);

  // keep: variant_series_map JOIN program_series!inner — forma del join no inferida.
  const variantSeries = (rawVariantSeries ?? []) as unknown as VariantSeriesRow[];
  const seriesId = seriesAtOrdinal(variantSeries, seriesNumber);
  if (!seriesId) return null;

  const weekNumbers = Array.from(new Set(dayKeys.map((k) => k.week_number)));
  const { data: rawDays } = await supabase
    .from("program_days")
    .select("week_number, day_of_week, title, day_type, workout_focus")
    .eq("series_id", seriesId)
    .in("week_number", weekNumbers);

  const days = (rawDays ?? []) as WeekDayRow[];
  const byKey = new Map(
    days.map((d) => [`${d.week_number}:${d.day_of_week}`, d])
  );

  return dayKeys.map((k: UpcomingDayKey) => {
    const day = byKey.get(`${k.week_number}:${k.day_of_week}`);
    return {
      date: k.date,
      day_of_week: k.day_of_week,
      isToday: k.isToday,
      title: day?.title ?? null,
      day_type: day?.day_type ?? null,
      workout_focus: day?.workout_focus ?? null,
    };
  });
}

/** Decisión pura (testeable): extrae el id de la fila de sub que concede acceso. */
export function pickAccessSubscriptionId(
  row: { id: string } | null
): string | null {
  return row?.id ?? null;
}

/**
 * Deriva la suscripción que concede acceso (ACCESS_STATES) del usuario.
 * Server-side: NO se confía en ningún subscriptionId del cliente (EDGE-5).
 */
export async function getAccessSubscriptionId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("profile_id", userId)
    .in("status", ACCESS_STATES)
    .maybeSingle();
  return pickAccessSubscriptionId(data as { id: string } | null);
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
  // Mismo "hoy" que getTodayContent, para que el día simulado y el log_date
  // sean coherentes en desarrollo.
  const logDate = serverToday().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("progress_logs")
    .upsert(
      {
        profile_id: params.userId,
        subscription_id: params.subscriptionId,
        program_day_id: params.programDayId,
        log_date: logDate,
        exercises_done: params.exercisesDone as Json,
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
