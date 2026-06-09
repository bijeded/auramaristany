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
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", "images");
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error || !json.storage_path) {
        setError(json.error ?? "Error al subir el archivo");
        return;
      }
      onChange({ storage_path: json.storage_path, alt: content.alt ?? "" });
    } catch {
      setError("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="image/*"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {uploading && <p className="text-sm font-body" style={{ color: "var(--gris-texto)" }}>Subiendo…</p>}
      {error && <p className="font-body" style={{ color: "#e05c5c", fontSize: 13 }}>{error}</p>}
      {content.storage_path && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${content.storage_path}`}
            alt={content.alt ?? "preview"}
            className="rounded-lg mb-2"
            style={{ maxWidth: 220, border: "1px solid var(--gris-linea)" }}
          />
          <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
          style={{ borderColor: "var(--gris-linea)" }}
          placeholder="Texto alternativo (alt)"
          value={content.alt ?? ""}
          onChange={(e) => onChange({ storage_path: content.storage_path!, alt: e.target.value })} />
        </>
      )}
    </div>
  );
}
