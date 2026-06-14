"use client";

import { useState } from "react";
import { AvatarUpload } from "./AvatarUpload";
import { AccountForm } from "./AccountForm";
import { Button } from "@/components/ui/button";

export function ProfileHeader({
  fullName, email, phone, avatarUrl,
}: { fullName: string; email: string; phone: string | null; avatarUrl: string | null }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-xl bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <AvatarUpload name={fullName} avatarUrl={avatarUrl} />
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <h2 className="font-head text-lg font-semibold" style={{ color: "var(--negro)" }}>{fullName || "—"}</h2>
        <p className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>{email}</p>
        <Button variant="outline" className="mt-3" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancelar" : "Editar perfil"}
        </Button>
      </div>
      {editing && (
        <AccountForm initialName={fullName} initialPhone={phone ?? ""} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}
