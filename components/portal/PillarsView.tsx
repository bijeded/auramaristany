"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BlockView } from "./blocks/BlockView";
import type { PillarWithBlocks } from "@/lib/content/pillars";

export function PillarsView({ pillars }: { pillars: PillarWithBlocks[] }) {
  const [open, setOpen] = useState<string | null>(pillars[0]?.id ?? null);
  if (pillars.length === 0) {
    return (
      <p className="font-body text-center py-12" style={{ color: "var(--gris-texto)" }}>
        Este mes no tiene pilares adicionales.
      </p>
    );
  }
  return (
    <div className="px-4 pt-4 pb-8 space-y-3">
      <h1 className="font-head text-2xl mb-2">Pilares del mes</h1>
      {pillars.map((p) => (
        <div key={p.id} className="rounded-xl border bg-white" style={{ borderColor: "var(--gris-linea)" }}>
          <button
            type="button"
            onClick={() => setOpen(open === p.id ? null : p.id)}
            className="flex w-full items-center justify-between p-4 font-head text-left"
          >
            {p.title}
            <ChevronDown size={18} style={{ transform: open === p.id ? "rotate(180deg)" : "none" }} />
          </button>
          {open === p.id && (
            <div className="px-4 pb-4">
              {p.blocks.map((b) => (
                <BlockView key={b.id} block={b} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
