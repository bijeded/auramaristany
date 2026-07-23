"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProgressLog } from "@/lib/content/queries";
import { lbToKg, kgToLb } from "@/lib/content/weight-units";

export type WeightUnit = "kg" | "lb";

// Invariante A1: los strings de peso del estado están en la unidad MOSTRADA
// (weightUnits por ejercicio); serializeExercises convierte a kg canónico al guardar.
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
  exercises: Record<string, ExerciseFormState>,
  weightUnits: Record<string, WeightUnit>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(exercises).map(([id, s]) => {
      const inLb = weightUnits[id] === "lb";
      return [
        id,
        {
          completed: s.completed,
          series: s.series.map((sv) => ({
            reps_done: sv.reps_done !== "" ? Number(sv.reps_done) : null,
            // El almacenamiento SIEMPRE es kg canónico (A1)
            weight_kg:
              sv.weight_kg !== ""
                ? inLb
                  ? lbToKg(Number(sv.weight_kg))
                  : Number(sv.weight_kg)
                : null,
          })),
        },
      ];
    })
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
  // A1: unidad de entrada por ejercicio (solo sesión; la hidratación siempre es kg)
  const [weightUnits, setWeightUnits] = useState<Record<string, WeightUnit>>({});
  const router = useRouter();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ exercises, generalNotes, weightUnits });

  useEffect(() => {
    latestRef.current = { exercises, generalNotes, weightUnits };
  }, [exercises, generalNotes, weightUnits]);

  const save = useCallback(async () => {
    setSaveStatus("saving");
    const { exercises: ex, generalNotes: notes, weightUnits: units } = latestRef.current;
    const completed = Object.values(ex).every((s) => s.completed);

    try {
      const res = await fetch("/api/portal/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId,
          subscriptionId,
          exercisesDone: serializeExercises(ex, units),
          generalNotes: notes,
          completed,
        }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        // Invalida la Router Cache de Next: al volver a /portal/today por
        // navegación interna, el RSC se re-renderiza con el existingLog recién
        // guardado (si no, se servía el payload cacheado con el form en blanco).
        router.refresh();
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [dayId, subscriptionId, router]);

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

  const setWeightUnit = useCallback(
    (exerciseId: string, unit: WeightUnit) => {
      // Lee la unidad vigente FUERA de los updaters (sin efectos dentro de ellos:
      // StrictMode los doble-invoca y una conversión doble corrompería el valor).
      const current = latestRef.current.weightUnits[exerciseId] ?? "kg";
      if (current === unit) return;

      const convert = unit === "lb" ? kgToLb : lbToKg;
      const isConvertible = (v: string) => v !== "" && !Number.isNaN(Number(v));

      // Updater puro: la conversión se recalcula dentro sin efectos laterales
      setExercises((prev) => {
        const ex = prev[exerciseId];
        if (!ex) return prev;
        return {
          ...prev,
          [exerciseId]: {
            ...ex,
            series: ex.series.map((sv) =>
              isConvertible(sv.weight_kg)
                ? { ...sv, weight_kg: String(convert(Number(sv.weight_kg))) }
                : sv
            ),
          },
        };
      });
      setWeightUnits((prevUnits) => ({ ...prevUnits, [exerciseId]: unit }));

      // Solo re-guarda si hubo valores que convertir (un flip en vacío no crea registro).
      // Decisión eager sobre el snapshot del ref — los updaters deben permanecer puros.
      // (El snapshot puede ser stale para un valor tecleado en el mismo tick; inofensivo:
      // ese updateSeries ya programó su propio save.)
      const snapshot = latestRef.current.exercises[exerciseId];
      if (snapshot?.series.some((sv) => isConvertible(sv.weight_kg))) scheduleSave();
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
    weightUnits,
    updateCompleted,
    updateSeries,
    updateGeneralNotes,
    setWeightUnit,
  };
}
