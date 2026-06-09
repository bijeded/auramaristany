"use client";
import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { BlockView } from "./blocks/BlockView";
import type { PillarWithBlocks } from "@/lib/content/pillars";

export function PillarsView({ pillars }: { pillars: PillarWithBlocks[] }) {
  const [open, setOpen] = useState<string | null>(pillars[0]?.id ?? null);
  if (pillars.length === 0) {
    return (
      <div className="px-4 pt-4 pb-8">
        <h1 className="font-head text-2xl mb-4">Pilares del mes</h1>
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--rosa-soft)", border: "1px solid var(--gris-linea)" }}>
          <div className="flex items-center justify-center rounded-full mx-auto mb-4"
            style={{ width: 56, height: 56, background: "rgba(255,255,255,0.7)" }}>
            <Sparkles size={26} color="var(--lavanda-dark)" />
          </div>
          <h2 className="font-head mb-2" style={{ fontSize: 18, fontWeight: 600 }}>
            Este mes no hay pilares adicionales
          </h2>
          <p className="font-body" style={{ color: "var(--gris-texto)", maxWidth: 300, margin: "0 auto" }}>
            Tu enfoque de este mes es la actividad física. Cuando haya contenido extra, aparecerá aquí.
          </p>
        </div>
      </div>
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
