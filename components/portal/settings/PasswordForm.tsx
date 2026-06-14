"use client";

import { useState } from "react";
import { updatePassword } from "@/lib/portal/settingsActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);
    setLoading(true);
    const res = await updatePassword({ currentPassword, newPassword, confirmPassword });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setSuccess(true);
    setCurrent(""); setNew(""); setConfirm("");
    // Muestra la confirmación un momento antes de colapsar el formulario.
    setTimeout(() => onDone?.(), 1200);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" style={{ marginTop: 14 }}>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-current">Contraseña actual</Label>
        <Input id="pwd-current" type="password" autoComplete="current-password"
          value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-new">Nueva contraseña</Label>
        <Input id="pwd-new" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres"
          value={newPassword} onChange={(e) => setNew(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pwd-confirm">Confirmar nueva contraseña</Label>
        <Input id="pwd-confirm" type="password" autoComplete="new-password"
          value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <p className="text-sm font-medium" style={{ color: "var(--error)" }}>{error}</p>}
      {success && <p className="text-sm font-medium" style={{ color: "var(--exito)" }}>Contraseña actualizada.</p>}
      <Button type="submit" disabled={loading} className="w-full font-head font-medium"
        style={{ background: "var(--lavanda)", color: "#fff" }}>
        {loading ? "Guardando..." : "Guardar contraseña"}
      </Button>
    </form>
  );
}
