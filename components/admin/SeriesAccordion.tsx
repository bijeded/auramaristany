"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Layers, MoreVertical } from "lucide-react";
import { WeeklyGrid } from "./WeeklyGrid";
import { SeriesFormModal } from "./SeriesFormModal";
import { SeriesDeleteDialog } from "./SeriesDeleteDialog";
import { deleteSeries } from "@/lib/admin/seriesActions";
import type { AdminSeries, AdminVariant } from "@/lib/admin/queries";

interface Props {
  series: AdminSeries;
  programId: string;
  programSlug?: string;
  defaultOpen?: boolean;
  variants: AdminVariant[];
}

export function SeriesAccordion({
  series,
  programId,
  programSlug,
  defaultOpen = false,
  variants,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"edit" | "delete" | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(undefined);
    const { error } = await deleteSeries(series.id, programId);
    setDeleteLoading(false);
    if (error) { setDeleteError(error); return; }
    setModal(null);
  }

  const publishedCount = series.days.filter((d) => d.published).length;
  const draftCount = series.days.filter((d) => !d.published).length;

  return (
    <>
      <div
        className="rounded-xl bg-white overflow-hidden"
        style={{ border: "1.5px solid var(--gris-linea)", boxShadow: "var(--shadow-card)" }}
      >
        {/* Header — div flex para poder anidar ambos botones */}
        <div className="flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-3 flex-1 text-left"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <div
              className="flex items-center justify-center rounded-lg font-head flex-shrink-0"
              style={{
                width: 36, height: 36,
                background: series.published ? "var(--lavanda-tint)" : "#f0f0f0",
                color: series.published ? "var(--lavanda-dark)" : "var(--gris-texto)",
                fontSize: 15, fontWeight: 700,
              }}
            >
              {series.series_number}
            </div>
            <div>
              <p className="font-head" style={{ fontSize: 15, fontWeight: 600, color: "var(--negro)" }}>
                Mes {series.series_number}{series.title ? ` — ${series.title}` : ""}
              </p>
              <p className="font-body" style={{ fontSize: 12, color: "var(--gris-texto)", marginTop: 2 }}>
                {publishedCount > 0 && (
                  <span style={{ color: "var(--lavanda-dark)", fontWeight: 600 }}>
                    {publishedCount} publicado{publishedCount !== 1 ? "s" : ""}
                  </span>
                )}
                {publishedCount > 0 && draftCount > 0 && " · "}
                {draftCount > 0 && `${draftCount} borrador${draftCount !== 1 ? "es" : ""}`}
                {publishedCount === 0 && draftCount === 0 && "Sin días creados"}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!series.published && (
              <span
                className="font-body rounded-full px-2.5 py-1"
                style={{ fontSize: 10.5, fontWeight: 600, background: "#f0f0f0", color: "var(--gris-texto)" }}
              >
                borrador
              </span>
            )}
            {/* Menú ⋯ */}
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--gris-texto)", padding: "4px",
                }}
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div
                  className="absolute z-10 right-0 mt-1 rounded-lg border bg-white shadow-md font-body"
                  style={{ borderColor: "var(--gris-linea)", fontSize: 13 }}
                >
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setModal("edit"); }}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setModal("delete"); }}
                    className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap"
                    style={{ color: "#e05c5c" }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
            {open ? (
              <ChevronUp size={18} color="var(--gris-suave)" />
            ) : (
              <ChevronDown size={18} color="var(--gris-suave)" />
            )}
          </div>
        </div>

        {/* Contenido expandido */}
        {open && (
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ borderTop: "1px solid var(--gris-linea)", paddingTop: 16 }}>
              {(programSlug === "cuarenta-mas" || programSlug === "cuarenta-mas-extra") && (
                <div className="mb-3">
                  <Link
                    href={`/admin/content/${programId}/series/${series.id}/pillars`}
                    className="inline-flex items-center gap-1.5 font-body rounded-lg px-3 py-1.5"
                    style={{
                      fontSize: 13, fontWeight: 600,
                      background: "var(--lavanda-soft)", color: "var(--lavanda-dark)",
                      border: "1px solid var(--lavanda-soft)",
                    }}
                  >
                    <Layers size={14} /> Pilares del mes
                  </Link>
                </div>
              )}
              <WeeklyGrid days={series.days} programId={programId} seriesId={series.id} />
            </div>
          </div>
        )}
      </div>

      {modal === "edit" && (
        <SeriesFormModal
          programId={programId}
          variants={variants}
          mode="edit"
          series={series}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "delete" && (
        <SeriesDeleteDialog
          series={series}
          onClose={() => { setModal(null); setDeleteError(undefined); }}
          onConfirm={handleDelete}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </>
  );
}
