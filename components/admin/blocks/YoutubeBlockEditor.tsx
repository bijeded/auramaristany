"use client";
import { useState } from "react";
import { extractVideoId } from "@/lib/admin/youtube";

export function YoutubeBlockEditor({
  content, onChange,
}: {
  content: { video_id?: string; title?: string };
  onChange: (c: { video_id: string; title: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const videoId = content.video_id ?? "";

  return (
    <div className="space-y-2">
      <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
        style={{ borderColor: "var(--gris-linea)" }}
        placeholder="Pega la URL de YouTube"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          const id = extractVideoId(e.target.value);
          if (id) onChange({ video_id: id, title: content.title ?? "" });
        }} />
      <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
        style={{ borderColor: "var(--gris-linea)" }}
        placeholder="Título (opcional)"
        value={content.title ?? ""}
        onChange={(e) => onChange({ video_id: videoId, title: e.target.value })} />
      {videoId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="preview"
          className="rounded-lg" style={{ width: 200 }} />
      )}
    </div>
  );
}
