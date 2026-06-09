"use client";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { cloneWeek } from "@/lib/admin/dayActions";

export function CloneWeekButton({ seriesId, week }: { seriesId: string; week: number }) {
  const router = useRouter();
  async function handle() {
    const target = Number(prompt(`Clonar semana ${week} a qué semana (1-4)?`));
    if (!target || target === week) return;
    const { error } = await cloneWeek(seriesId, week, target, false);
    if (error) {
      if (confirm(error + ". ¿Sobrescribir los días existentes?")) {
        const retry = await cloneWeek(seriesId, week, target, true);
        if (retry.error) { alert("Error: " + retry.error); return; }
      } else return;
    }
    router.refresh();
  }
  return (
    <button type="button" onClick={handle}
      className="flex items-center gap-1 font-body text-xs" style={{ color: "var(--lavanda-dark)" }}>
      <Copy size={12} /> Clonar semana
    </button>
  );
}
