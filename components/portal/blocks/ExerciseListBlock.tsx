"use client";

import { Play, Check } from "lucide-react";
import { useState } from "react";
import type { ExerciseFormState, ExerciseSeriesEntry } from "@/hooks/useProgressForm";
import { formatRestLabel } from "@/lib/content/rest-label";

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
  video_url?: string;
  metrics: string[];
}

interface ExerciseListBlockContent {
  exercises: Exercise[];
}

interface Props {
  content: ExerciseListBlockContent;
  formState: Record<string, ExerciseFormState>;
  onUpdateCompleted: (exerciseId: string, completed: boolean) => void;
  onUpdateSeries: (
    exerciseId: string,
    index: number,
    field: keyof ExerciseSeriesEntry,
    value: string
  ) => void;
}

function ExerciseVideoDemo({ videoUrl, name }: { videoUrl: string; name: string }) {
  const [playing, setPlaying] = useState(false);
  const videoId = videoUrl.includes("youtube.com/watch?v=")
    ? videoUrl.split("v=")[1]?.split("&")[0]
    : videoUrl.includes("youtu.be/")
    ? videoUrl.split("youtu.be/")[1]?.split("?")[0]
    : null;

  if (!videoId) return null;

  return (
    <div
      className="mt-3 overflow-hidden rounded-lg"
      style={{ aspectRatio: "16/9", background: "#1a1a1a" }}
    >
      {playing ? (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={`Demo: ${name}`}
        />
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="relative w-full h-full flex items-center justify-center"
          aria-label={`Ver demostración de ${name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt={`Demo ${name}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/25" />
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{ width: 48, height: 48, background: "rgba(255,255,255,0.9)" }}
          >
            <Play size={20} fill="var(--lavanda)" color="var(--lavanda)" style={{ marginLeft: 2 }} />
          </div>
          <span
            className="absolute bottom-2 left-2 font-body"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              background: "rgba(26,26,26,0.65)",
              color: "#fff",
              padding: "2px 7px",
              borderRadius: 5,
            }}
          >
            Ver demostración
          </span>
        </button>
      )}
    </div>
  );
}

function MetricInputs({
  exercise,
  state,
  onUpdateSeries,
}: {
  exercise: Exercise;
  state: ExerciseFormState;
  onUpdateSeries: (index: number, field: keyof ExerciseSeriesEntry, value: string) => void;
}) {
  const showReps = exercise.metrics.includes("reps_done");
  const showWeight = exercise.metrics.includes("weight_kg");

  if (!showReps && !showWeight) return null;

  const cols = [showReps, showWeight].filter(Boolean).length;
  const gridCols = cols === 2 ? "60px 1fr 1fr" : "60px 1fr";

  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: "var(--gris-claro)" }}>
      <p
        className="font-body mb-2"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--gris-texto)",
          letterSpacing: "0.4px",
          textTransform: "uppercase",
        }}
      >
        Mi registro · {exercise.sets} series de {exercise.reps} reps
      </p>

      {/* Column headers */}
      <div className="grid mb-1" style={{ gridTemplateColumns: gridCols, gap: "6px" }}>
        <div />
        {showReps && (
          <p className="font-body text-center" style={{ fontSize: 11, fontWeight: 600, color: "var(--gris-texto)" }}>
            Reps
          </p>
        )}
        {showWeight && (
          <p className="font-body text-center" style={{ fontSize: 11, fontWeight: 600, color: "var(--gris-texto)" }}>
            Peso (kg)
          </p>
        )}
      </div>

      {/* One row per series */}
      {state.series.map((sv, i) => (
        <div key={i} className="grid items-center mb-1" style={{ gridTemplateColumns: gridCols, gap: "6px" }}>
          <p className="font-body" style={{ fontSize: 12, fontWeight: 600, color: "var(--gris-texto)" }}>
            Serie {i + 1}
          </p>
          {showReps && (
            <input
              type="text"
              inputMode="numeric"
              value={sv.reps_done}
              onChange={(e) => onUpdateSeries(i, "reps_done", e.target.value)}
              placeholder={exercise.reps}
              className="w-full font-body text-center rounded-lg"
              style={{
                padding: "8px 4px",
                border: "1.5px solid var(--gris-linea)",
                fontSize: 14,
                background: "#fff",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--lavanda)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--gris-linea)")}
            />
          )}
          {showWeight && (
            <input
              type="text"
              inputMode="decimal"
              value={sv.weight_kg}
              onChange={(e) => onUpdateSeries(i, "weight_kg", e.target.value)}
              placeholder="0"
              className="w-full font-body text-center rounded-lg"
              style={{
                padding: "8px 4px",
                border: "1.5px solid var(--gris-linea)",
                fontSize: 14,
                background: "#fff",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--lavanda)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--gris-linea)")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function ExerciseListBlock({ content, formState, onUpdateCompleted, onUpdateSeries }: Props) {
  const { exercises } = content;
  const doneCount = exercises.filter((e) => formState[e.id]?.completed).length;
  const allDone = doneCount === exercises.length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-head" style={{ fontSize: 18, fontWeight: 600 }}>
          Ejercicios de hoy
        </h3>
        <span
          className="font-body"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: allDone ? "#4caf7d" : "var(--gris-texto)",
          }}
        >
          {doneCount}/{exercises.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {exercises.map((ex, i) => {
          const state = formState[ex.id] ?? {
            completed: false,
            series: Array.from({ length: ex.sets }, () => ({ reps_done: "", weight_kg: "" })),
          };
          const done = state.completed;

          return (
            <div
              key={ex.id}
              className="rounded-xl p-4"
              style={{
                background: done ? "rgba(76,175,125,0.05)" : "#fff",
                border: `1.5px solid ${done ? "rgba(76,175,125,0.4)" : "var(--gris-linea)"}`,
                transition: "all 0.2s ease",
                boxShadow: "var(--shadow-card)",
              }}
            >
              {/* Exercise header */}
              <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-lg font-head"
                    style={{
                      width: 28,
                      height: 28,
                      background: done ? "#4caf7d" : "var(--lavanda-tint)",
                      color: done ? "#fff" : "var(--lavanda-dark)",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {i + 1}
                  </div>
                  <p
                    className="font-head"
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      textDecoration: done ? "line-through" : "none",
                      color: done ? "var(--gris-texto)" : "var(--negro)",
                    }}
                  >
                    {ex.name}
                  </p>
              </div>

              {/* Badges */}
              <div className="flex gap-2 flex-wrap mt-2">
                <span
                  className="font-body rounded-full px-3 py-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    background: "var(--lavanda-tint)",
                    color: "var(--lavanda-dark)",
                  }}
                >
                  {ex.sets} × {ex.reps}
                </span>
                <span
                  className="font-body rounded-full px-3 py-1"
                  style={{
                    fontSize: 12,
                    background: "var(--gris-claro)",
                    color: "var(--gris-texto)",
                  }}
                >
                  Descanso {formatRestLabel(ex.rest_seconds)}
                </span>
              </div>

              {/* Coach notes */}
              {ex.notes && (
                <p
                  className="font-body mt-2"
                  style={{ fontSize: 13, color: "var(--lavanda-dark)", fontStyle: "italic" }}
                >
                  {ex.notes}
                </p>
              )}

              {/* Demo video */}
              {!done && ex.video_url && (
                <ExerciseVideoDemo videoUrl={ex.video_url} name={ex.name} />
              )}

              {/* Metric inputs — one row per series */}
              {!done && (
                <MetricInputs
                  exercise={ex}
                  state={state}
                  onUpdateSeries={(index, field, value) => onUpdateSeries(ex.id, index, field, value)}
                />
              )}

              {/* A3 — explicit "Hecho" toggle button (≥48px tap target) */}
              <button
                type="button"
                onClick={() => onUpdateCompleted(ex.id, !done)}
                aria-pressed={done}
                aria-label={done ? `Desmarcar ${ex.name}` : `Marcar ${ex.name} como completado`}
                className="w-full mt-3 flex items-center justify-center gap-2 rounded-full font-body"
                style={{
                  minHeight: 48,
                  fontSize: 15,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                  background: done ? "var(--lavanda)" : "#fff",
                  color: done ? "#fff" : "var(--lavanda-dark)",
                  border: "1.5px solid var(--lavanda)",
                }}
              >
                <Check size={18} strokeWidth={3} />
                {done ? "Hecho" : "Marcar como hecho"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Celebration banner */}
      {allDone && (
        <div
          className="mt-4 rounded-xl p-4 text-center"
          style={{ background: "rgba(76,175,125,0.1)" }}
        >
          <p className="font-head" style={{ fontSize: 17, fontWeight: 600, color: "#3a8c60" }}>
            ¡Excelente trabajo hoy!
          </p>
          <p className="font-body mt-1" style={{ fontSize: 13, color: "#3a8c60" }}>
            Completaste todos tus ejercicios. Sigue así.
          </p>
        </div>
      )}
    </div>
  );
}
