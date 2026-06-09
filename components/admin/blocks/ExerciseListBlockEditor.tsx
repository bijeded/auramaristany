"use client";
import { Trash2, Plus } from "lucide-react";

interface Exercise {
  id: string; name: string; sets: number; reps: string;
  rest_seconds: number; notes: string; video_url: string; metrics: string[];
}

export function ExerciseListBlockEditor({
  content, onChange,
}: {
  content: { exercises?: Exercise[] };
  onChange: (c: { exercises: Exercise[] }) => void;
}) {
  const exercises = content.exercises ?? [];

  const update = (next: Exercise[]) => onChange({ exercises: next });
  const setField = (i: number, patch: Partial<Exercise>) =>
    update(exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const toggleMetric = (i: number, metric: string, on: boolean) => {
    const cur = exercises[i].metrics;
    setField(i, { metrics: on ? (cur.includes(metric) ? cur : [...cur, metric]) : cur.filter((m) => m !== metric) });
  };
  const add = () => update([...exercises, {
    id: crypto.randomUUID(), name: "", sets: 3, reps: "12",
    rest_seconds: 60, notes: "", video_url: "", metrics: ["reps_done"],
  }]);

  const input = "rounded-lg border px-2 py-1.5 font-body text-sm";
  const border = { borderColor: "var(--gris-linea)" };

  return (
    <div className="space-y-3">
      {exercises.map((ex, i) => (
        <div key={ex.id} className="rounded-lg border p-3 space-y-2" style={border}>
          <div className="flex justify-between items-center">
            <input className={`${input} flex-1`} style={border} placeholder="Nombre del ejercicio"
              value={ex.name} onChange={(e) => setField(i, { name: e.target.value })} />
            <button type="button" onClick={() => update(exercises.filter((_, idx) => idx !== i))}
              className="ml-2 text-[var(--gris-texto)]"><Trash2 size={15} /></button>
          </div>
          <div className="flex gap-2">
            <input className={`${input} w-20`} style={border} type="number" placeholder="Series"
              value={ex.sets} onChange={(e) => setField(i, { sets: Number(e.target.value) })} />
            <input className={`${input} w-24`} style={border} placeholder="Reps"
              value={ex.reps} onChange={(e) => setField(i, { reps: e.target.value })} />
            <input className={`${input} w-28`} style={border} type="number" placeholder="Descanso (s)"
              value={ex.rest_seconds} onChange={(e) => setField(i, { rest_seconds: Number(e.target.value) })} />
          </div>
          <input className={`${input} w-full`} style={border} placeholder="Notas del coach"
            value={ex.notes} onChange={(e) => setField(i, { notes: e.target.value })} />
          <input className={`${input} w-full`} style={border} placeholder="URL de video demo (opcional)"
            value={ex.video_url} onChange={(e) => setField(i, { video_url: e.target.value })} />
          <div className="flex gap-4 text-sm font-body">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={ex.metrics.includes("reps_done")}
                onChange={(e) => toggleMetric(i, "reps_done", e.target.checked)} /> Registrar reps
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={ex.metrics.includes("weight_kg")}
                onChange={(e) => toggleMetric(i, "weight_kg", e.target.checked)} /> Registrar peso (kg)
            </label>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-sm font-body" style={{ color: "var(--lavanda-dark)" }}>
        <Plus size={15} /> Agregar ejercicio
      </button>
    </div>
  );
}
