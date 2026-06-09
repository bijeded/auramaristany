"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { WeeklyGrid } from "./WeeklyGrid";
import type { AdminSeries } from "@/lib/admin/queries";

interface Props {
  series: AdminSeries;
  programId: string;
  programSlug?: string;
  defaultOpen?: boolean;
}

export function SeriesAccordion({ series, programId, programSlug, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const publishedCount = series.days.filter((d) => d.published).length;
  const draftCount = series.days.filter((d) => !d.published).length;

  return (
    <div
      className="rounded-xl bg-white overflow-hidden"
      style={{ border: "1.5px solid var(--gris-linea)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-lg font-head flex-shrink-0"
            style={{
              width: 36,
              height: 36,
              background: series.published ? "var(--lavanda-tint)" : "#f0f0f0",
              color: series.published ? "var(--lavanda-dark)" : "var(--gris-texto)",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {series.series_number}
          </div>
          <div className="text-left">
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
        </div>
        <div className="flex items-center gap-2">
          {!series.published && (
            <span
              className="font-body rounded-full px-2.5 py-1"
              style={{ fontSize: 10.5, fontWeight: 600, background: "#f0f0f0", color: "var(--gris-texto)" }}
            >
              borrador
            </span>
          )}
          {open ? (
            <ChevronUp size={18} color="var(--gris-suave)" />
          ) : (
            <ChevronDown size={18} color="var(--gris-suave)" />
          )}
        </div>
      </button>

      {/* Grid */}
      {open && (
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ borderTop: "1px solid var(--gris-linea)", paddingTop: 16 }}>
            {(programSlug === "cuarenta-mas" || programSlug === "cuarenta-mas-extra") && (
              <div className="mb-3">
                <Link
                  href={`/admin/content/${programId}/series/${series.id}/pillars`}
                  className="inline-flex items-center gap-1.5 font-body rounded-lg px-3 py-1.5"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    background: "var(--lavanda-soft)",
                    color: "var(--lavanda-dark)",
                    border: "1px solid var(--lavanda-soft)",
                  }}
                >
                  <Layers size={14} /> Pilares del mes
                </Link>
              </div>
            )}
            <WeeklyGrid
              days={series.days}
              programId={programId}
              seriesId={series.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
