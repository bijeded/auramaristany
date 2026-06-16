"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { SeriesFormModal } from "./SeriesFormModal";
import type { AdminVariant } from "@/lib/admin/queries";

interface Props {
  programId: string;
  variants: AdminVariant[];
}

export function NewSeriesButton({ programId, variants }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 font-body rounded-xl px-4 py-2"
        style={{
          fontSize: 13,
          fontWeight: 600,
          background: "var(--lavanda-tint)",
          color: "var(--lavanda-dark)",
          border: "none",
          cursor: "pointer",
        }}
      >
        <PlusCircle size={16} />
        Nueva serie
      </button>
      {open && (
        <SeriesFormModal
          programId={programId}
          variants={variants}
          mode="create"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
