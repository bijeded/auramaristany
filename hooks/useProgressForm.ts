"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgressLog } from "@/lib/content/queries";

export interface ExerciseSeriesEntry {
  reps_done: string;
  weight_kg: string;
}

export interface ExerciseFormState {
  completed: boolean;
  series: ExerciseSeriesEntry[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Params {
  dayId: string;
  subscriptionId: string;
  existingLog: ProgressLog | null;
  exercises: { id: string; sets: number }[];
}

type SavedEntry = {
  completed?: boolean;
  series?: Array<{ reps_done?: number | null; weight_kg?: number | null }>;
};

function initFromLog(
  exerciseDefs: { id: string; sets: number }[],
  log: ProgressLog | null
): Record<string, ExerciseFormState> {
  const saved = (log?.exercises_done ?? {}) as Record<string, SavedEntry>;
  return Object.fromEntries(
    exerciseDefs.map(({ id, sets }) => {
      const s = saved[id];
      return [
        id,
        {
          completed: s?.completed ?? false,
          series: Array.from({ length: sets }, (_, i) => ({
            reps_done: s?.series?.[i]?.reps_done != null ? String(s.series![i].reps_done) : "",
            weight_kg: s?.series?.[i]?.weight_kg != null ? String(s.series![i].weight_kg) : "",
          })),
        },
      ];
    })
  );
}

function serializeExercises(
  exercises: Record<string, ExerciseFormState>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(exercises).map(([id, s]) => [
      id,
      {
        completed: s.completed,
        series: s.series.map((sv) => ({
          reps_done: sv.reps_done !== "" ? Number(sv.reps_done) : null,
          weight_kg: sv.weight_kg !== "" ? Number(sv.weight_kg) : null,
        })),
      },
    ])
  );
}

export function useProgressForm({
  dayId,
  subscriptionId,
  existingLog,
  exercises: exerciseDefs,
}: Params) {
  const [exercises, setExercises] = useState<Record<string, ExerciseFormState>>(
    () => initFromLog(exerciseDefs, existingLog)
  );
  const [generalNotes, setGeneralNotes] = useState(
    existingLog?.general_notes ?? ""
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ exercises, generalNotes });

  useEffect(() => {
    latestRef.current = { exercises, generalNotes };
  }, [exercises, generalNotes]);

  const save = useCallback(async () => {
    setSaveStatus("saving");
    const { exercises: ex, generalNotes: notes } = latestRef.current;
    const completed = Object.values(ex).every((s) => s.completed);

    try {
      const res = await fetch("/api/portal/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId,
          subscriptionId,
          exercisesDone: serializeExercises(ex),
          generalNotes: notes,
          completed,
        }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }, [dayId, subscriptionId]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("idle");
    debounceRef.current = setTimeout(save, 1500);
  }, [save]);

  const updateCompleted = useCallback(
    (exerciseId: string, completed: boolean) => {
      setExercises((prev) => ({
        ...prev,
        [exerciseId]: { ...(prev[exerciseId] ?? { series: [] }), completed },
      }));
      scheduleSave();
    },
    [scheduleSave]
  );

  const updateSeries = useCallback(
    (
      exerciseId: string,
      index: number,
      field: keyof ExerciseSeriesEntry,
      value: string
    ) => {
      setExercises((prev) => {
        const ex = prev[exerciseId] ?? { completed: false, series: [] };
        const newSeries = [...ex.series];
        newSeries[index] = {
          ...(newSeries[index] ?? { reps_done: "", weight_kg: "" }),
          [field]: value,
        };
        return { ...prev, [exerciseId]: { ...ex, series: newSeries } };
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  const updateGeneralNotes = useCallback(
    (notes: string) => {
      setGeneralNotes(notes);
      scheduleSave();
    },
    [scheduleSave]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    exercises,
    generalNotes,
    saveStatus,
    updateCompleted,
    updateSeries,
    updateGeneralNotes,
  };
}
