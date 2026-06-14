"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validatePhone } from "@/lib/auth/phone";
import { updateAccount } from "@/lib/portal/settingsActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountForm({
  initialName, initialPhone, onDone,
}: { initialName: string; initialPhone: string; onDone?: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.ok) { setError(phoneCheck.error!); return; }
    if (fullName.trim().length === 0) { setError("Ingresa tu nombre."); return; }

    setLoading(true);
    const res = await updateAccount({ fullName, phone });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setSuccess(true);
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" style={{ marginTop: 14 }}>
      <div className="space-y-1.5">
        <Label htmlFor="acc-name">Nombre completo</Label>
        <Input id="acc-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acc-phone">Núm. Celular (con lada de país)</Label>
        <Input id="acc-phone" type="tel" autoComplete="tel" placeholder="+52 55 1234 5678"
          value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>
      {error && <p className="text-sm font-medium" style={{ color: "var(--error)" }}>{error}</p>}
      {success && <p className="text-sm font-medium" style={{ color: "var(--exito)" }}>Datos actualizados.</p>}
      <Button type="submit" disabled={loading} className="w-full font-head font-medium"
        style={{ background: "var(--lavanda)", color: "#fff" }}>
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
