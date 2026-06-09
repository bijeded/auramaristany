"use client";

import { useState } from "react";
import { PortalHeader } from "./PortalHeader";
import { PerformanceTab } from "./PerformanceTab";
import { PhotosTab, type PhotoItem } from "./PhotosTab";
import type { PerfExercise } from "@/lib/content/history-helpers";
import type { HistoryListItem } from "@/lib/content/history";

function todayLabel(): string {
  const s = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ProgressView({
  performance,
  history,
  photos,
}: {
  performance: PerfExercise[];
  history: HistoryListItem[];
  photos: PhotoItem[];
}) {
  const [tab, setTab] = useState<"desempeno" | "fotos">("desempeno");

  return (
    <div style={{ background: "var(--blanco)", minHeight: "100%" }}>
      <PortalHeader dateLabel={todayLabel()} />

      <div style={{ padding: "0 18px", borderBottom: "1px solid var(--gris-linea)" }}>
        <div className="flex gap-6">
          {[["desempeno", "Desempeño"], ["fotos", "Fotos"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v as "desempeno" | "fotos")}
              className="font-body"
              style={{
                padding: "14px 0",
                fontSize: 14,
                fontWeight: 600,
                color: tab === v ? "var(--negro)" : "var(--gris-suave)",
                borderBottom: tab === v ? "2px solid var(--lavanda)" : "2px solid transparent",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 18px 28px" }}>
        {tab === "desempeno" ? (
          <PerformanceTab performance={performance} history={history} />
        ) : (
          <PhotosTab photos={photos} />
        )}
      </div>
    </div>
  );
}
