"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { AdminDay } from "@/lib/admin/queries";

const WEEKS = [1, 2, 3, 4];
const DAYS = [
  { key: "lunes", label: "Lun" },
  { key: "martes", label: "Mar" },
  { key: "miercoles", label: "Mié" },
  { key: "jueves", label: "Jue" },
  { key: "viernes", label: "Vie" },
  { key: "sabado", label: "Sáb" },
  { key: "domingo", label: "Dom" },
] as const;

interface Props {
  days: AdminDay[];
  programId: string;
  seriesId: string;
}

export function WeeklyGrid({ days, programId, seriesId }: Props) {
  // Build lookup: dayMap[week_number][day_of_week] = AdminDay
  const dayMap: Record<number, Record<string, AdminDay>> = {};
  for (const day of days) {
    if (!dayMap[day.week_number]) dayMap[day.week_number] = {};
    dayMap[day.week_number][day.day_of_week] = day;
  }

  return (
    <div className="overflow-x-auto">
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            <th
              className="font-body"
              style={{ width: 64, padding: "6px 8px", fontSize: 11, color: "var(--gris-suave)", fontWeight: 400, textAlign: "left" }}
            />
            {DAYS.map((d) => (
              <th
                key={d.key}
                className="font-body"
                style={{ padding: "6px 4px", fontSize: 11, fontWeight: 600, color: "var(--gris-texto)", textAlign: "center", letterSpacing: "0.03em" }}
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKS.map((week) => (
            <tr key={week}>
              <td
                className="font-body"
                style={{ padding: "4px 8px 4px 0", fontSize: 11, fontWeight: 600, color: "var(--gris-suave)", whiteSpace: "nowrap", verticalAlign: "middle" }}
              >
                Sem {week}
              </td>
              {DAYS.map((d) => {
                const day = dayMap[week]?.[d.key];
                return (
                  <td key={d.key} style={{ padding: "3px" }}>
                    <GridCell
                      day={day ?? null}
                      programId={programId}
                      seriesId={seriesId}
                      week={week}
                      dow={d.key}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridCell({
  day,
  programId,
  seriesId,
  week,
  dow,
}: {
  day: AdminDay | null;
  programId: string;
  seriesId: string;
  week: number;
  dow: string;
}) {
  const baseStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    minHeight: 56,
    padding: "6px 4px",
    fontSize: 11,
    textAlign: "center",
    textDecoration: "none",
    transition: "opacity 0.15s",
    cursor: "pointer",
  };

  if (!day) {
    return (
      <Link
        href={`/admin/content/${programId}/series/${seriesId}/days/new?week=${week}&dow=${dow}`}
        style={{
          ...baseStyle,
          background: "#fff",
          border: "1.5px dashed var(--gris-linea)",
          color: "var(--gris-suave)",
        }}
      >
        <Plus size={14} strokeWidth={1.5} />
      </Link>
    );
  }

  const published = day.published;

  return (
    <Link
      href={`/admin/content/${programId}/series/${seriesId}/days/${day.id}`}
      style={{
        ...baseStyle,
        background: published ? "var(--lavanda-tint)" : "#f0f0f0",
        border: `1.5px solid ${published ? "rgba(130,100,180,0.25)" : "var(--gris-linea)"}`,
        color: published ? "var(--lavanda-dark)" : "var(--gris-texto)",
      }}
    >
      {day.workout_focus ? (
        <span className="font-body" style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.3 }}>
          {day.workout_focus}
        </span>
      ) : (
        <span className="font-body" style={{ fontSize: 10.5, color: "var(--gris-suave)" }}>
          {day.title}
        </span>
      )}
      {!published && (
        <span
          className="font-body mt-1"
          style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.04em", color: "var(--gris-suave)", textTransform: "uppercase" }}
        >
          borrador
        </span>
      )}
    </Link>
  );
}
