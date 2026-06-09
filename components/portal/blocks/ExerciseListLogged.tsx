import { Check } from "lucide-react";
import type { ReadOnlyExercise } from "./ExerciseListReadOnly";
import type { ExercisesDone } from "@/lib/content/history-helpers";

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  reps_done: { label: "Reps", unit: "" },
  weight_kg: { label: "Peso", unit: " kg" },
};

function formatMetric(metric: string, value: number | null | undefined): string {
  if (value == null) return "—";
  const cfg = METRIC_LABELS[metric] ?? { label: metric, unit: "" };
  return `${value}${cfg.unit}`;
}

export function ExerciseListLogged({
  content,
  loggedExercises,
}: {
  content: { exercises: ReadOnlyExercise[] };
  loggedExercises: ExercisesDone | null;
}) {
  const exercises = content?.exercises ?? [];
  if (exercises.length === 0) return null;
  const done = loggedExercises ?? {};

  return (
    <div className="mb-6 flex flex-col gap-3">
      {exercises.map((ex) => {
        const entry = done[ex.id];
        const series = entry?.series ?? [];
        const metrics = ex.metrics ?? ["reps_done", "weight_kg"];
        return (
          <div
            key={ex.id}
            className="rounded-xl p-4"
            style={{
              background: "#fff",
              border: "1.5px solid var(--gris-linea)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between">
              <p className="font-head" style={{ fontSize: 16, fontWeight: 600 }}>
                {ex.name}
              </p>
              {entry?.completed && (
                <span
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 22, height: 22, background: "rgba(76,175,125,.16)" }}
                >
                  <Check size={14} color="#3a8c60" />
                </span>
              )}
            </div>

            <p className="font-body mt-1" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
              Meta: {ex.sets}×{ex.reps}
              {ex.rest_seconds != null && <> · Descanso: {ex.rest_seconds} seg</>}
            </p>

            <div className="mt-3 flex flex-col gap-1.5">
              {Array.from({ length: ex.sets }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 font-body"
                  style={{ fontSize: 13 }}
                >
                  <span style={{ color: "var(--gris-texto)", minWidth: 56 }}>
                    Serie {i + 1}
                  </span>
                  {metrics.map((m) => (
                    <span key={m} style={{ fontWeight: 600 }}>
                      {METRIC_LABELS[m]?.label ?? m}: {formatMetric(m, series[i]?.[m])}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
