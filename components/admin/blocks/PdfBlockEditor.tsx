// components/admin/blocks/PdfBlockEditor.tsx
"use client";
import { useState } from "react";

export function PdfBlockEditor({
  content, onChange,
}: {
  content: { storage_path?: string; filename?: string; label?: string };
  onChange: (c: { storage_path: string; filename: string; label: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", "pdfs");
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error || !json.storage_path) {
        setError(json.error ?? "Error al subir el archivo");
        return;
      }
      onChange({ storage_path: json.storage_path, filename: json.filename, label: content.label ?? "Descargar PDF" });
    } catch {
      setError("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="application/pdf"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {uploading && <p className="text-sm font-body" style={{ color: "var(--gris-texto)" }}>Subiendo…</p>}
      {error && <p className="font-body" style={{ color: "#e05c5c", fontSize: 13 }}>{error}</p>}
      {content.storage_path && (
        <>
          <p className="text-sm font-body">✓ {content.filename}</p>
          <input className="w-full rounded-lg border px-3 py-2 font-body text-sm"
            style={{ borderColor: "var(--gris-linea)" }}
            placeholder="Etiqueta del enlace"
            value={content.label ?? ""}
            onChange={(e) => onChange({
              storage_path: content.storage_path!, filename: content.filename ?? "", label: e.target.value,
            })} />
        </>
      )}
    </div>
  );
}
