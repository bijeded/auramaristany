"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { PasswordForm } from "./PasswordForm";

export function SecuritySection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full" style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <Lock size={18} color="var(--gris-texto)" />
        <span className="font-body text-sm font-medium flex-1" style={{ color: "var(--negro)" }}>Cambiar contraseña</span>
        <span className="font-body text-sm" style={{ color: "var(--lavanda-dark)" }}>{open ? "Cerrar" : "Editar"}</span>
      </button>
      {open && <PasswordForm onDone={() => setOpen(false)} />}
    </div>
  );
}
