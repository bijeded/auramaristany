"use client";

import Link from "next/link";
import { ChevronLeft, Clock, Dumbbell } from "lucide-react";
import { PortalHeader } from "./PortalHeader";
import { BlockView } from "./blocks/BlockView";
import type { HistoryLogDetail } from "@/lib/content/history";

function formatLogDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  const str = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function HistoryDayView({ detail }: { detail: HistoryLogDetail }) {
  const dateLabel = formatLogDate(detail.logDate);

  return (
    <div style={{ background: "var(--blanco)" }}>
      <PortalHeader dateLabel={dateLabel} />

      <div className="px-4 pt-4 pb-8">
        <Link
          href="/portal/history"
          className="flex items-center gap-1 font-body mb-4"
          style={{ fontSize: 13, color: "var(--gris-texto)" }}
        >
          <ChevronLeft size={16} />
          Volver al historial
        </Link>

        <div className="mb-5">
          <span
            className="inline-flex items-center gap-1.5 font-body rounded-full px-3 py-1 mb-2"
            style={{ fontSize: 12, fontWeight: 600, background: "var(--rosa)", color: "#5e3d38" }}
          >
            📅 {dateLabel}
          </span>
          <h1 className="font-head mb-3" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
            {detail.day.title}
          </h1>
          <div className="flex gap-2 flex-wrap">
            {detail.day.workout_focus && (
              <span
                className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
                style={{ fontSize: 12.5, fontWeight: 600, background: "var(--lavanda-tint)", color: "var(--lavanda-dark)" }}
              >
                <Dumbbell size={13} />
                {detail.day.workout_focus}
              </span>
            )}
            {detail.day.duration_minutes && (
              <span
                className="flex items-center gap-1.5 font-body rounded-full px-3 py-1"
                style={{ fontSize: 12.5, background: "var(--gris-claro)", color: "var(--gris-texto)" }}
              >
                <Clock size={13} />
                {detail.day.duration_minutes} minutos
              </span>
            )}
          </div>
        </div>

        {detail.blocks.map((block) => (
          <BlockView key={block.id} block={block} loggedExercises={detail.exercisesDone} />
        ))}

        {detail.generalNotes && (
          <div className="mt-4">
            <p className="font-body mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
              Mis notas de ese día
            </p>
            <p
              className="font-body rounded-xl"
              style={{ padding: "12px 14px", background: "var(--gris-claro)", fontSize: 14, whiteSpace: "pre-wrap" }}
            >
              {detail.generalNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
