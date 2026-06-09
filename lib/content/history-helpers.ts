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

// Clave de agrupación: el ejercicio se identifica por su NOMBRE normalizado
// (no por uuid), para conectar el mismo ejercicio a lo largo de los días aunque
// Aura lo haya creado desde cero en cada día (uuids distintos).
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

interface NameGroup {
  displayName: string;
  metrics: string[]; // unión, en orden de aparición
  byDate: Map<string, SeriesEntry[]>; // series acumuladas por fecha
}

export function buildPerformanceSeries(
  logs: LogForPerf[],
  meta: Map<string, ExerciseMeta>
): PerfExercise[] {
  const groups = new Map<string, NameGroup>();
  const sorted = [...logs].sort((a, b) => a.logDate.localeCompare(b.logDate));

  for (const log of sorted) {
    const done = log.exercisesDone ?? {};
    for (const [exId, entry] of Object.entries(done)) {
      const m = meta.get(exId);
      if (!m) continue;

      const key = normalizeName(m.name);
      let g = groups.get(key);
      if (!g) {
        g = { displayName: m.name, metrics: [], byDate: new Map() };
        groups.set(key, g);
      }
      for (const metric of m.metrics) {
        if (!g.metrics.includes(metric)) g.metrics.push(metric);
      }
      const daySeries = g.byDate.get(log.logDate) ?? [];
      daySeries.push(...(entry?.series ?? []));
      g.byDate.set(log.logDate, daySeries);
    }
  }

  const result: PerfExercise[] = [];
  for (const g of Array.from(groups.values())) {
    const points: PerfPoint[] = [];
    for (const date of Array.from(g.byDate.keys()).sort()) {
      const series = g.byDate.get(date) ?? [];
      const values: Record<string, number | null> = {};
      let hasAny = false;
      for (const metric of g.metrics) {
        const v = aggregateDayValue(series, metric);
        values[metric] = v;
        if (v != null) hasAny = true;
      }
      if (hasAny) points.push({ date, values });
    }
    result.push({ exerciseId: normalizeName(g.displayName), name: g.displayName, metrics: g.metrics, points });
  }

  return result;
}
