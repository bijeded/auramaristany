"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Plus } from "lucide-react";
import { saveDay, saveBlocks } from "@/lib/admin/dayActions";
import type { DayWithBlocks } from "@/lib/admin/queries";
import { TextBlockEditor } from "./blocks/TextBlockEditor";
import { YoutubeBlockEditor } from "./blocks/YoutubeBlockEditor";
import { PdfBlockEditor } from "./blocks/PdfBlockEditor";
import { ImageBlockEditor } from "./blocks/ImageBlockEditor";
import { ExerciseListBlockEditor } from "./blocks/ExerciseListBlockEditor";
import { CardioZone2BlockEditor } from "./blocks/CardioZone2BlockEditor";

type BlockType = "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
interface EditorBlock { key: string; block_type: BlockType; content: Record<string, unknown>; }

const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Texto", youtube: "Video YouTube", pdf: "PDF", image: "Imagen",
  exercise_list: "Lista de ejercicios", cardio_zone2: "Calculadora Cardio Zona 2",
};

const DAY_TYPE_OPTIONS: { value: "workout" | "rest" | "cardio"; label: string }[] = [
  { value: "workout", label: "Entrenamiento" },
  { value: "rest", label: "Descanso" },
  { value: "cardio", label: "Protocolo Cardiovascular" },
];

function SortableBlock({ block, children, onRemove }: {
  block: EditorBlock; children: React.ReactNode; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.key });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition,
        border: "1.5px solid var(--gris-linea)", borderRadius: 12, background: "white",
        boxShadow: "var(--shadow-card)", padding: 12, marginBottom: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button type="button" {...attributes} {...listeners} className="cursor-grab text-[var(--gris-texto)]">
            <GripVertical size={16} />
          </button>
          <span className="font-head text-sm">{BLOCK_LABELS[block.block_type]}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-[var(--gris-texto)]"><X size={16} /></button>
      </div>
      {children}
    </div>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);

  const addBlock = (t: BlockType) => {
    setBlocks([...blocks, { key: crypto.randomUUID(), block_type: t, content: {} }]);
    setMenuOpen(false);
  };
  const updateBlock = (key: string, content: Record<string, unknown>) =>
    setBlocks(blocks.map((b) => (b.key === key ? { ...b, content } : b)));
  const removeBlock = (key: string) => setBlocks(blocks.filter((b) => b.key !== key));

  const onDragEnd = (e: { active: { id: string | number }; over: { id: string | number } | null }) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldI = blocks.findIndex((b) => b.key === e.active.id);
    const newI = blocks.findIndex((b) => b.key === e.over!.id);
    const next = [...blocks];
    const [moved] = next.splice(oldI, 1);
    next.splice(newI, 0, moved);
    setBlocks(next);
  };

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

  function renderEditor(b: EditorBlock) {
    switch (b.block_type) {
      case "text": return <TextBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "youtube": return <YoutubeBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "pdf": return <PdfBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "image": return <ImageBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "exercise_list": return <ExerciseListBlockEditor content={b.content} onChange={(c) => updateBlock(b.key, c)} />;
      case "cardio_zone2": return <CardioZone2BlockEditor />;
    }
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

      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.key)} strategy={verticalListSortingStrategy}>
          {blocks.map((b) => (
            <SortableBlock key={b.key} block={b} onRemove={() => removeBlock(b.key)}>
              {renderEditor(b)}
            </SortableBlock>
          ))}
        </SortableContext>
      </DndContext>

      <div className="relative mb-6">
        <button type="button" onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>
          <Plus size={16} /> Agregar bloque
        </button>
        {menuOpen && (
          <div className="absolute z-10 mt-1 rounded-lg border bg-white shadow-md" style={border}>
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
              <button key={t} type="button" onClick={() => addBlock(t)}
                className="block w-full text-left px-4 py-2 font-body text-sm hover:bg-[var(--lavanda-tint)]">
                {BLOCK_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
        className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50"
        style={{ background: "var(--lavanda)" }}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
