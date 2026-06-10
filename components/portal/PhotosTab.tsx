"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { compressImage } from "@/lib/portal/photo-compress";
import { MAX_PHOTOS } from "@/lib/portal/photo-validation";
import { monthKey, monthLabel, dayLabel } from "@/lib/admin/date-helpers";

export interface PhotoItem {
  id: string;
  url: string; // signed URL
  photoDate: string; // "YYYY-MM-DD"
  caption: string | null;
}

export function PhotosTab({ photos }: { photos: PhotoItem[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");

  const months = useMemo(() => {
    const keys = Array.from(new Set(photos.map((p) => monthKey(p.photoDate)))).sort().reverse();
    return keys;
  }, [photos]);
  const [filter, setFilter] = useState<string>("todas");

  const visible = filter === "todas" ? photos : photos.filter((p) => monthKey(p.photoDate) === filter);

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(pendingFile);
      const form = new FormData();
      form.append("file", compressed);
      if (caption.trim()) form.append("caption", caption.trim());
      const res = await fetch("/api/portal/photos", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se pudo subir la foto.");
      } else {
        setPendingFile(null);
        setCaption("");
        router.refresh();
      }
    } catch {
      setError("No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/portal/photos/${id}`, { method: "DELETE" });
    setViewIdx(null);
    router.refresh();
  }

  return (
    <>
      {/* Encabezado: contador de uso + botón subir */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span className="font-body" style={{ fontSize: 13, color: "var(--gris-texto)" }}>
          Fotos de progreso
        </span>
        <span
          className="font-body rounded-full px-2.5 py-1"
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            background: photos.length >= MAX_PHOTOS ? "rgba(224,92,92,.14)" : "var(--gris-claro)",
            color: photos.length >= MAX_PHOTOS ? "#c0463f" : "var(--gris-texto)",
          }}
        >
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {/* Botón subir */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={photos.length >= MAX_PHOTOS}
        className="flex items-center justify-center gap-2 w-full rounded-xl font-body"
        style={{ padding: "12px", background: "var(--lavanda)", color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 16, opacity: photos.length >= MAX_PHOTOS ? 0.5 : 1 }}
      >
        <Camera size={18} /> Subir foto
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPendingFile(f);
          e.target.value = "";
        }}
      />

      {/* Filtro por mes */}
      {months.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ marginBottom: 16 }}>
          {[["todas", "Todas"], ...months.map((m) => [m, monthLabel(m)] as [string, string])].map(
            ([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className="font-body whitespace-nowrap rounded-full px-3 py-1.5"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  background: filter === v ? "var(--lavanda)" : "var(--gris-claro)",
                  color: filter === v ? "#fff" : "var(--gris-texto)",
                }}
              >
                {l}
              </button>
            )
          )}
        </div>
      )}

      {/* Grid o empty */}
      {visible.length === 0 ? (
        <div className="font-body" style={{ textAlign: "center", padding: "40px 10px", fontSize: 14, color: "var(--gris-texto)" }}>
          Aún no tienes fotos de progreso. Sube tu primera para empezar.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {visible.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setViewIdx(i)}
              style={{ border: "none", padding: 0, borderRadius: 10, overflow: "hidden", position: "relative", cursor: "pointer", aspectRatio: "1" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.caption ?? "Foto de progreso"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(26,26,26,.6)", color: "#fff", fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 5 }}>
                {dayLabel(f.photoDate)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Modal de confirmación de subida (comentario) */}
      {pendingFile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(26,26,26,.6)", display: "flex", alignItems: "flex-end" }}>
          <div className="w-full rounded-t-2xl" style={{ background: "#fff", padding: 20, maxWidth: 640, margin: "0 auto" }}>
            <p className="font-head" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Nueva foto</p>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Comentario (opcional). No se puede editar después."
              rows={2}
              className="w-full font-body rounded-xl resize-none"
              style={{ padding: "12px 14px", background: "var(--gris-claro)", border: "1.5px solid transparent", fontSize: 14, outline: "none", marginBottom: 12 }}
            />
            {error && <p className="font-body" style={{ color: "#e05c5c", fontSize: 13, marginBottom: 10 }}>{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setPendingFile(null); setCaption(""); setError(null); }}
                className="flex-1 rounded-xl font-body"
                style={{ padding: 12, background: "var(--gris-claro)", fontWeight: 600, fontSize: 14 }}
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 rounded-xl font-body"
                style={{ padding: 12, background: "var(--lavanda)", color: "#fff", fontWeight: 600, fontSize: 14 }}
                disabled={uploading}
              >
                {uploading ? "Subiendo…" : "Subir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor (lightbox) */}
      {viewIdx !== null && visible[viewIdx] && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(26,26,26,.92)", display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between" style={{ padding: 16 }}>
            <span className="font-body" style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
              {dayLabel(visible[viewIdx].photoDate)}
            </span>
            <button onClick={() => setViewIdx(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X size={24} color="#fff" />
            </button>
          </div>
          <div className="flex items-center justify-center" style={{ flex: 1, padding: "0 16px", position: "relative" }}>
            {viewIdx > 0 && (
              <button onClick={() => setViewIdx(viewIdx - 1)} style={{ position: "absolute", left: 8, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronLeft size={22} color="#fff" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={visible[viewIdx].url} alt={visible[viewIdx].caption ?? "Foto"} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 12 }} />
            {viewIdx < visible.length - 1 && (
              <button onClick={() => setViewIdx(viewIdx + 1)} style={{ position: "absolute", right: 8, background: "rgba(255,255,255,.15)", border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronRight size={22} color="#fff" />
              </button>
            )}
          </div>
          <div style={{ padding: 16 }}>
            {visible[viewIdx].caption && (
              <p className="font-body" style={{ color: "#fff", fontSize: 14, marginBottom: 12, textAlign: "center" }}>
                {visible[viewIdx].caption}
              </p>
            )}
            <button
              onClick={() => handleDelete(visible[viewIdx].id)}
              className="flex items-center justify-center gap-2 w-full rounded-xl font-body"
              style={{ padding: 12, background: "rgba(224,92,92,.18)", color: "#ff9b9b", fontWeight: 600, fontSize: 14 }}
            >
              <Trash2 size={16} /> Borrar foto
            </button>
          </div>
        </div>
      )}
    </>
  );
}
