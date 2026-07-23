import Link from "next/link";
import { ChevronRight, Moon } from "lucide-react";
import { PortalHeader } from "./PortalHeader";
import type { WeekCalendarRow } from "@/lib/content/queries";

// "YYYY-MM-DD" → "Lun 22 jul" (T12:00:00 evita el corrimiento de día en UTC)
function formatRowDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  const str = date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function todayLabel(): string {
  const s = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function RowContent({ row }: { row: WeekCalendarRow }) {
  const isRest = row.title === null;
  return (
    <>
      <div style={{ minWidth: 86 }}>
        <span
          className="font-body"
          style={{
            fontSize: 12,
            fontWeight: row.isToday ? 700 : 500,
            color: row.isToday ? "var(--lavanda)" : "var(--gris-suave)",
          }}
        >
          {row.isToday ? "Hoy" : formatRowDate(row.date)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {isRest ? (
          <span
            className="font-body flex items-center gap-1.5"
            style={{ fontSize: 14, color: "var(--gris-suave)" }}
          >
            <Moon size={14} strokeWidth={1.8} />
            Descanso
          </span>
        ) : (
          <>
            <span
              className="font-body block truncate"
              style={{
                fontSize: 14,
                fontWeight: row.isToday ? 600 : 400,
                color: "var(--gris-texto)",
              }}
            >
              {row.title}
            </span>
            {row.workout_focus && (
              <span
                className="font-body block truncate"
                style={{ fontSize: 12, color: "var(--gris-suave)" }}
              >
                {row.workout_focus}
              </span>
            )}
          </>
        )}
      </div>
      {row.isToday && (
        <ChevronRight size={18} style={{ color: "var(--lavanda)" }} />
      )}
    </>
  );
}

export function WeekView({ rows }: { rows: WeekCalendarRow[] | null }) {
  return (
    <div style={{ background: "var(--blanco)" }}>
      <PortalHeader dateLabel={todayLabel()} />

      <div className="px-4 pt-5 pb-8">
        <h1
          className="font-head font-semibold mb-1"
          style={{ fontSize: 22, color: "var(--gris-texto)" }}
        >
          Mi semana
        </h1>
        <p
          className="font-body mb-5"
          style={{ fontSize: 13, color: "var(--gris-suave)" }}
        >
          Lo que viene en tus próximos días
        </p>

        {!rows || rows.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center font-body"
            style={{
              background: "var(--rosa-soft)",
              color: "var(--gris-suave)",
              fontSize: 14,
            }}
          >
            Tu nueva serie se activa con tu próximo pago. ¡Nos vemos muy
            pronto!
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--gris-linea)" }}
          >
            {rows.map((row, i) => {
              const rowStyle = {
                borderTop: i > 0 ? "1px solid var(--gris-linea)" : undefined,
                background: row.isToday ? "var(--rosa-soft)" : undefined,
                minHeight: 56,
              };
              return row.isToday ? (
                <Link
                  key={row.date}
                  href="/portal/today"
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ ...rowStyle, textDecoration: "none" }}
                >
                  <RowContent row={row} />
                </Link>
              ) : (
                <div
                  key={row.date}
                  className="flex items-center gap-3 px-4 py-3"
                  style={rowStyle}
                >
                  <RowContent row={row} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
