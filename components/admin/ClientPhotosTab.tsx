"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { monthKey, monthLabel, dayLabel } from "@/lib/admin/date-helpers";
import type { ClientPhoto } from "@/lib/admin/clients-queries";

export function ClientPhotosTab({ clientId, photos }: { clientId: string; photos: ClientPhoto[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("todas");
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const months = useMemo(
    () => Array.from(new Set(photos.map((p) => monthKey(p.photoDate)))).sort().reverse(),
    [photos]
  );
  const visible = filter === "todas" ? photos : photos.filter((p) => monthKey(p.photoDate) === filter);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta foto? Es permanente.")) return;
    setDeleting(id);
    await fetch(`/api/admin/clients/${clientId}/photos/${id}`, { method: "DELETE" });
    setViewIdx(null);
    setDeleting(null);
    router.refresh();
  }

  if (photos.length === 0) {
    return <p className="font-body" style={{ color: "var(--gris-texto)", fontSize: 14 }}>Este cliente no ha subido fotos.</p>;
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
        <button className={"pill " + (filter === "todas" ? "active" : "")} onClick={() => setFilter("todas")}>Todas</button>
        {months.map((m) => (
          <button key={m} className={"pill " + (filter === m ? "active" : "")} onClick={() => setFilter(m)}>{monthLabel(m)}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {visible.map((p) => {
          const idx = photos.indexOf(p);
          return (
            <div key={p.id} style={{ borderRadius: 10, overflow: "hidden", position: "relative", aspectRatio: "1", cursor: "pointer" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? "Foto de progreso"} onClick={() => setViewIdx(idx)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(26,26,26,.6)", color: "#fff", fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 5, fontFamily: "var(--font-body)" }}>
                {dayLabel(p.photoDate)}
              </span>
              <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                title="Eliminar foto"
                style={{ position: "absolute", top: 6, right: 6, background: "rgba(26,26,26,.6)", border: "none", borderRadius: 6, padding: 5, cursor: "pointer", color: "#fff" }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {viewIdx !== null && photos[viewIdx] && (
        <div onClick={() => setViewIdx(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <button onClick={() => setViewIdx(null)} style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[viewIdx].url} alt={photos[viewIdx].caption ?? "Foto"} onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 10, objectFit: "contain" }} />
        </div>
      )}
    </>
  );
}
