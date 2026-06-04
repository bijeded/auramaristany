"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password/update`,
    });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-white p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(76,175,125,0.12)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--exito)" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="font-head text-2xl font-semibold mb-3">Revisa tu correo</h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--gris-texto)" }}>
          Si existe una cuenta con ese correo, recibirás instrucciones en los próximos minutos.
        </p>
        <Link href="/auth/login">
          <Button variant="outline" className="w-full">
            Volver al inicio de sesión
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-7" style={{ boxShadow: "var(--shadow-card)" }}>
      <h1 className="font-head text-2xl font-semibold text-center mb-2">¿Olvidaste tu contraseña?</h1>
      <p className="text-sm text-center mb-6" style={{ color: "var(--gris-texto)" }}>
        Ingresa tu correo y te enviaremos un enlace para restablecerla.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full font-head font-medium"
          style={{ background: "var(--lavanda)", color: "#fff" }}
        >
          {loading ? "Enviando..." : "Enviar enlace"}
        </Button>
      </form>
      <p className="text-sm text-center mt-4">
        <Link href="/auth/login" className="underline" style={{ color: "var(--lavanda-dark)" }}>
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
