import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  countCompleted,
  countExercisesInBlocks,
  buildPerformanceSeries,
  type ExerciseMeta,
  type ExercisesDone,
  type LogForPerf,
  type PerfExercise,
} from "./history-helpers";
import type { DayBlock } from "./queries";

export interface HistoryListItem {
  logId: string;
  logDate: string;
  dayTitle: string;
  workoutFocus: string | null;
  doneCount: number;
  totalCount: number;
}

export interface HistoryLogDetail {
  logId: string;
  logDate: string;
  day: {
    id: string;
    title: string;
    workout_focus: string | null;
    duration_minutes: number | null;
    day_of_week: string;
  };
  blocks: DayBlock[];
  exercisesDone: ExercisesDone | null;
  generalNotes: string | null;
}

// --- Tipos crudos de los SELECT (Relationships no tipadas en Database) ---
interface ListRow {
  id: string;
  log_date: string;
  program_day_id: string;
  exercises_done: ExercisesDone | null;
  program_days: { title: string; workout_focus: string | null; day_of_week: string };
}

interface BlockRow {
  day_id: string;
  block_type: string;
  sort_order: number;
  content: Record<string, unknown>;
}

/**
 * Lista cronológica (reciente primero) de días con progress_log del cliente.
 */
export async function getHistoryList(userId: string): Promise<HistoryListItem[]> {
  const supabase = await createClient();

  const { data: rawLogs } = await supabase
    .from("progress_logs")
    .select(
      `id, log_date, program_day_id, exercises_done,
       program_days!inner ( title, workout_focus, day_of_week )`
    )
    .eq("profile_id", userId)
    .order("log_date", { ascending: false });

  const logs = (rawLogs ?? []) as unknown as ListRow[];
  if (logs.length === 0) return [];

  // Conteo total de ejercicios por día (de los bloques exercise_list).
  const dayIds = Array.from(new Set(logs.map((l) => l.program_day_id)));
  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("day_id, block_type, sort_order, content")
    .in("day_id", dayIds);

  const blocks = (rawBlocks ?? []) as unknown as BlockRow[];
  const totalByDay = new Map<string, number>();
  for (const id of dayIds) {
    totalByDay.set(
      id,
      countExercisesInBlocks(blocks.filter((b) => b.day_id === id))
    );
  }

  return logs.map((l) => ({
    logId: l.id,
    logDate: l.log_date,
    dayTitle: l.program_days.title,
    workoutFocus: l.program_days.workout_focus,
    doneCount: countCompleted(l.exercises_done),
    totalCount: totalByDay.get(l.program_day_id) ?? 0,
  }));
}

interface SubRow {
  id: string;
  months_elapsed: number;
  current_period_start: string | null;
}

interface PerfLogRow {
  log_date: string;
  program_day_id: string;
  exercises_done: ExercisesDone | null;
}

interface ExBlockRow {
  day_id: string;
  block_type: string;
  content: { exercises?: Array<{ id: string; name: string; metrics?: string[] }> };
}

/**
 * Datos de las gráficas de desempeño, SOLO del mes corriente
 * (log_date >= current_period_start de la suscripción activa).
 */
export async function getPerformanceData(userId: string): Promise<PerfExercise[]> {
  const supabase = await createClient();

  const { data: rawSub } = await supabase
    .from("subscriptions")
    .select("id, months_elapsed, current_period_start")
    .eq("profile_id", userId)
    .eq("status", "active")
    .single();

  const sub = rawSub as unknown as SubRow | null;
  if (!sub || !sub.current_period_start) return [];

  const periodStart = sub.current_period_start.split("T")[0];

  const { data: rawLogs } = await supabase
    .from("progress_logs")
    .select("log_date, program_day_id, exercises_done")
    .eq("profile_id", userId)
    .gte("log_date", periodStart)
    .order("log_date", { ascending: true });

  const logs = (rawLogs ?? []) as unknown as PerfLogRow[];
  if (logs.length === 0) return [];

  const dayIds = Array.from(new Set(logs.map((l) => l.program_day_id)));
  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("day_id, block_type, content")
    .in("day_id", dayIds)
    .eq("block_type", "exercise_list");

  const blocks = (rawBlocks ?? []) as unknown as ExBlockRow[];

  // Mapa exercise-uuid → { name, metrics } desde los bloques del mes.
  const meta = new Map<string, ExerciseMeta>();
  for (const b of blocks) {
    for (const ex of b.content?.exercises ?? []) {
      if (!meta.has(ex.id)) {
        meta.set(ex.id, { name: ex.name, metrics: ex.metrics ?? [] });
      }
    }
  }

  const perfLogs: LogForPerf[] = logs.map((l) => ({
    logDate: l.log_date,
    exercisesDone: l.exercises_done,
  }));

  return buildPerformanceSeries(perfLogs, meta);
}

interface DetailLogRow {
  id: string;
  log_date: string;
  program_day_id: string;
  exercises_done: ExercisesDone | null;
  general_notes: string | null;
}

interface DetailDayRow {
  id: string;
  title: string;
  workout_focus: string | null;
  duration_minutes: number | null;
  day_of_week: string;
}

/**
 * Detalle read-only de un día pasado. Valida que el log sea del cliente.
 * Devuelve null si no existe o no le pertenece.
 */
export async function getHistoryLog(
  userId: string,
  logId: string
): Promise<HistoryLogDetail | null> {
  const supabase = await createClient();

  const { data: rawLog } = await supabase
    .from("progress_logs")
    .select("id, log_date, program_day_id, exercises_done, general_notes:notes")
    .eq("id", logId)
    .eq("profile_id", userId)
    .maybeSingle();

  const log = rawLog as unknown as DetailLogRow | null;
  if (!log) return null;

  const { data: rawDay } = await supabase
    .from("program_days")
    .select("id, title, workout_focus, duration_minutes, day_of_week")
    .eq("id", log.program_day_id)
    .single();

  const day = rawDay as unknown as DetailDayRow | null;
  if (!day) return null;

  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("id, block_type, sort_order, content")
    .eq("day_id", day.id)
    .order("sort_order");

  return {
    logId: log.id,
    logDate: log.log_date,
    day,
    blocks: (rawBlocks ?? []) as DayBlock[],
    exercisesDone: log.exercises_done,
    generalNotes: log.general_notes,
  };
}
