// Funciones puras para el historial y las gráficas de desempeño.
// Sin acceso a DB: 100% testeables.

export interface SeriesEntry {
  reps_done?: number | null;
  weight_kg?: number | null;
  [metric: string]: number | null | undefined;
}

export interface ExerciseDoneEntry {
  completed?: boolean;
  series?: SeriesEntry[];
}

export type ExercisesDone = Record<string, ExerciseDoneEntry>;

export interface ExerciseMeta {
  name: string;
  metrics: string[];
}

export interface LogForPerf {
  logDate: string; // "YYYY-MM-DD"
  exercisesDone: ExercisesDone | null;
}

export interface PerfPoint {
  date: string;
  values: Record<string, number | null>;
}

export interface PerfExercise {
  exerciseId: string;
  name: string;
  metrics: string[];
  points: PerfPoint[];
}

// Métricas que se suman a lo largo del día; el resto se promedian.
const SUM_METRICS = new Set(["reps_done"]);

export function countCompleted(done: ExercisesDone | null | undefined): number {
  if (!done) return 0;
  return Object.values(done).filter((e) => e?.completed === true).length;
}

interface BlockLike {
  block_type: string;
  content: Record<string, unknown>;
}

export function countExercisesInBlocks(blocks: BlockLike[]): number {
  return blocks
    .filter((b) => b.block_type === "exercise_list")
    .reduce((sum, b) => {
      const exercises = (b.content as { exercises?: unknown[] })?.exercises ?? [];
      return sum + exercises.length;
    }, 0);
}

export function aggregateDayValue(
  series: SeriesEntry[] | undefined,
  metric: string
): number | null {
  if (!series || series.length === 0) return null;
  const vals = series
    .map((s) => s?.[metric])
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  if (SUM_METRICS.has(metric)) return sum;
  return Math.round((sum / vals.length) * 100) / 100;
}

export function buildPerformanceSeries(
  logs: LogForPerf[],
  meta: Map<string, ExerciseMeta>
): PerfExercise[] {
  const byExercise = new Map<string, PerfExercise>();
  const sorted = [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate));

  for (const log of sorted) {
    const done = log.exercisesDone ?? {};
    for (const [exId, entry] of Object.entries(done)) {
      const m = meta.get(exId);
      if (!m) continue;

      let pe = byExercise.get(exId);
      if (!pe) {
        pe = { exerciseId: exId, name: m.name, metrics: m.metrics, points: [] };
        byExercise.set(exId, pe);
      }

      const values: Record<string, number | null> = {};
      let hasAny = false;
      for (const metric of m.metrics) {
        const v = aggregateDayValue(entry?.series, metric);
        values[metric] = v;
        if (v != null) hasAny = true;
      }
      if (hasAny) pe.points.push({ date: log.logDate, values });
    }
  }

  return Array.from(byExercise.values());
}
