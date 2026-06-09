"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { cloneDay, deleteDay } from "@/lib/admin/dayActions";

const DOWS = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"];

export function DayCellMenu({ dayId, seriesId }: { dayId: string; seriesId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function handleDelete() {
    if (!confirm("¿Eliminar este día y su contenido?")) return;
    const { error } = await deleteDay(dayId);
    if (error) alert("Error: " + error);
    else router.refresh();
  }

  async function handleClone() {
    const week = Number(prompt("Semana destino (1-4)?"));
    const dow = prompt(`Día destino (${DOWS.join(", ")})?`);
    if (!week || !dow || !DOWS.includes(dow)) return;
    const { error } = await cloneDay(dayId, { seriesId, weekNumber: week, dayOfWeek: dow }, false);
    if (error) {
      if (confirm(error + ". ¿Sobrescribir?")) {
        const retry = await cloneDay(dayId, { seriesId, weekNumber: week, dayOfWeek: dow }, true);
        if (retry.error) { alert("Error: " + retry.error); return; }
      } else return;
    }
    router.refresh();
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        className="text-[var(--gris-texto)]"><MoreVertical size={14} /></button>
      {open && (
        <div className="absolute z-10 right-0 mt-1 rounded-lg border bg-white shadow-md text-sm font-body"
          style={{ borderColor: "var(--gris-linea)" }}>
          <button type="button" onClick={handleClone}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap">Clonar a…</button>
          <button type="button" onClick={handleDelete}
            className="block w-full text-left px-3 py-1.5 hover:bg-[var(--lavanda-tint)] whitespace-nowrap"
            style={{ color: "#e05c5c" }}>Eliminar</button>
        </div>
      )}
    </div>
  );
}
