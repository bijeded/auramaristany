"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BlockListEditor, type EditorBlock } from "./BlockListEditor";
import { savePillar, savePillarBlocks } from "@/lib/admin/pillarActions";

export function PillarEditorForm({ seriesId, programId, pillarKey, pillarName, pillar }: {
  seriesId: string; programId: string; pillarKey: string; pillarName: string;
  pillar: { id: string | null; title: string; published: boolean; blocks: { id: string; block_type: string; content: Record<string, unknown> }[] };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(pillar.title);
  const [published, setPublished] = useState(pillar.published);
  const [blocks, setBlocks] = useState<EditorBlock[]>(
    pillar.blocks.map((b) => ({ key: b.id, block_type: b.block_type as EditorBlock["block_type"], content: b.content })));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { pillarId, error } = await savePillar({ seriesId, pillarKey, title, published });
    if (error) { setSaving(false); alert("Error: " + error); return; }
    await savePillarBlocks(pillarId, blocks.map((b) => ({ block_type: b.block_type, content: b.content })));
    setSaving(false);
    router.push(`/admin/content/${programId}/series/${seriesId}/pillars`);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-head text-xl mb-1">{pillarName}</h1>
      <input className="w-full rounded-lg border px-3 py-2 font-body text-sm mb-3"
        style={{ borderColor: "var(--gris-linea)" }} placeholder="Título"
        value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center gap-2 font-body text-sm mb-6">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publicado
      </label>
      <BlockListEditor blocks={blocks} setBlocks={setBlocks} />
      <button type="button" onClick={handleSave} disabled={saving || title.trim() === ""}
        className="font-head px-6 py-2.5 rounded-xl text-white disabled:opacity-50 mt-4"
        style={{ background: "var(--lavanda)" }}>{saving ? "Guardando…" : "Guardar"}</button>
    </div>
  );
}
