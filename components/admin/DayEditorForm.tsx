"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDay, saveBlocks } from "@/lib/admin/dayActions";
import type { DayWithBlocks } from "@/lib/admin/queries";
import { BlockListEditor, type EditorBlock, type BlockType } from "./BlockListEditor";

const DAY_TYPE_OPTIONS: { value: "workout" | "rest" | "cardio"; label: string }[] = [
  { value: "workout", label: "Entrenamiento" },
  { value: "rest", label: "Descanso" },
  { value: "cardio", label: "Protocolo Cardiovascular" },
];

export function DayEditorForm({ day, seriesId, programId, weekNumber, dayOfWeek }: {
  day: DayWithBlocks | null;
  seriesId: string; programId: string; weekNumber: number; dayOfWeek: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(day?.title ?? "");
  const [workoutFocus, setWorkoutFocus] = useState(day?.workout_focus ?? "");
  const [dayType, setDayType] = useState<"workout" | "rest" | "cardio">(
    (day?.day_type as "workout" | "rest" | "cardio") ?? "workout");
  const [duration, setDuration] = useState(day?.duration_minutes?.toString() ?? "");
  const [published, setPublished] = useState(day?.published ?? false);
  const [blocks, setBlocks] = useState<EditorBlock[]>(
    (day?.blocks ?? []).map((b) => ({ key: b.id, block_type: b.block_type as BlockType, content: b.content })));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { dayId, error } = await saveDay({
      id: day?.id, seriesId, weekNumber, dayOfWeek, title,
      workoutFocus: workoutFocus.trim() === "" ? null : workoutFocus,
      dayType, durationMinutes: duration === "" ? null : Number(duration), published,
    });
    if (error) { setSaving(false); alert("Error: " + error); return; }
    await saveBlocks(dayId, blocks.map((b) => ({ block_type: b.block_type, content: b.content })));
    setSaving(false);
    router.push(`/admin/content/${programId}`);
    router.refresh();
  }

  const field = "w-full rounded-lg border px-3 py-2 font-body text-sm";
  const border = { borderColor: "var(--gris-linea)" };

  return (
    <div className="max-w-2xl">
      <p className="font-body text-sm mb-4" style={{ color: "var(--gris-texto)" }}>
        Semana {weekNumber} — {dayOfWeek}
      </p>

      <div className="space-y-3 mb-6">
        <input className={field} style={border} placeholder="Título del día"
          value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={field} style={border} placeholder="Enfoque (opcional, ej. Tren Inferior)"
          value={workoutFocus} onChange={(e) => setWorkoutFocus(e.target.value)} />
        <select className={field} style={border} value={dayType}
          onChange={(e) => setDayType(e.target.value as "workout" | "rest" | "cardio")}>
          {DAY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className={field} style={border} type="number" placeholder="Duración (min, opcional)"
          value={duration} onChange={(e) => setDuration(e.target.value)} />
        <label className="flex items-center gap-2 font-body text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publicado
        </label>
      </div>

      <BlockListEditor blocks={blocks} setBlocks={setBlocks} />

      <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
        className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50"
        style={{ background: "var(--lavanda)" }}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
