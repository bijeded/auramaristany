// components/admin/blocks/ImageBlockEditor.tsx
"use client";
import { useState } from "react";

export function ImageBlockEditor({
  content, onChange,
}: {
  content: { storage_path?: string; alt?: string };
  onChange: (c: { storage_path: string; alt: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", "images");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (json.storage_path) onChange({ storage_path: json.storage_path, alt: content.alt ?? "" });
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="image/*"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {uploading && <p className="text-sm font-body" style={{ color: "var(--gris-texto)" }}>Subiendo…</p>}
      {content.storage_path && (
        <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
          style={{ borderColor: "var(--gris-linea)" }}
          placeholder="Texto alternativo (alt)"
          value={content.alt ?? ""}
          onChange={(e) => onChange({ storage_path: content.storage_path!, alt: e.target.value })} />
      )}
    </div>
  );
}
