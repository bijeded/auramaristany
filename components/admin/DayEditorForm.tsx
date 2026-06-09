"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { saveDay, saveBlocks } from "@/lib/admin/dayActions";
import type { DayWithBlocks } from "@/lib/admin/queries";
import { BlockListEditor, type EditorBlock, type BlockType } from "./BlockListEditor";

export function DayEditorForm({ day, seriesId, programId, weekNumber, dayOfWeek }: {
  day: DayWithBlocks | null;
  seriesId: string; programId: string; weekNumber: number; dayOfWeek: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(day?.title ?? "");
  const [workoutFocus, setWorkoutFocus] = useState(day?.workout_focus ?? "");
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
      dayType: "workout", durationMinutes: duration === "" ? null : Number(duration), published,
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
      <div className="flex items-center justify-between mb-6">
        <Link href={`/admin/content/${programId}`}
          className="flex items-center gap-1 font-body" style={{ fontSize: 14, color: "var(--lavanda-dark)" }}>
          <ChevronLeft size={16} /> Volver a la serie
        </Link>
        <div className="flex items-center gap-2">
          <select value={published ? "publicado" : "borrador"}
            onChange={(e) => setPublished(e.target.value === "publicado")}
            className="rounded-lg border px-3 py-2 font-body" style={{ fontSize: 13, borderColor: "var(--gris-linea)", paddingRight: 28 }}>
            <option value="borrador">Borrador</option>
            <option value="publicado">Publicado</option>
          </select>
          <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
            className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50"
            style={{ background: "var(--lavanda)" }}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="mb-2 font-body" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", color: "var(--lavanda-dark)", textTransform: "uppercase" }}>
        Programa de Actividad Física
      </div>
      <p className="font-body mb-4" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
        Semana {weekNumber} — {dayOfWeek}
      </p>
      <div className="space-y-3 mb-6">
        <div>
          <label className="block font-body mb-1" style={{ fontSize: 12, color: "var(--gris-texto)" }}>Título del día</label>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)}
            style={{ ...border, fontFamily: "var(--font-head)", fontWeight: 600, fontSize: 18 }} />
        </div>
        <div>
          <label className="block font-body mb-1" style={{ fontSize: 12, color: "var(--gris-texto)" }}>Enfoque</label>
          <input className={field} style={border} placeholder="Ej. Tren Inferior, Protocolo Cardiovascular, Descanso"
            value={workoutFocus} onChange={(e) => setWorkoutFocus(e.target.value)} />
        </div>
        <div>
          <label className="block font-body mb-1" style={{ fontSize: 12, color: "var(--gris-texto)" }}>Duración (min)</label>
          <input className={field} style={{ ...border, width: 120 }} type="number"
            value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
      </div>

      <BlockListEditor blocks={blocks} setBlocks={setBlocks} />
    </div>
  );
}
