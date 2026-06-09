"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: (() => {
          const next = searchParams.get("next");
          const base = `${window.location.origin}/auth/callback`;
          return next && next.startsWith("/") ? `${base}?next=${encodeURIComponent(next)}` : base;
        })(),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="rounded-xl bg-white p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "var(--lavanda-tint)" }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lavanda)" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="font-head text-2xl font-semibold mb-3">¡Ya casi! Revisa tu correo</h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--gris-texto)" }}>
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Haz clic en él para
          activar tu cuenta.
        </p>
        <Link href={searchParams.get("next") ? `/auth/login?next=${encodeURIComponent(searchParams.get("next")!)}` : "/auth/login"}>
          <Button variant="outline" className="w-full">
            Volver al inicio de sesión
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-7" style={{ boxShadow: "var(--shadow-card)" }}>
      <h1 className="font-head text-2xl font-semibold text-center mb-1">Crea tu cuenta</h1>
      <p className="text-sm text-center mb-6" style={{ color: "var(--gris-texto)" }}>
        Para acceder a tu programa de Aura
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            placeholder="María Elena García"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--error)" }}>
            {error}
          </p>
        )}

        <div
          className="flex items-start gap-2.5 cursor-pointer"
          onClick={() => setTerms((t) => !t)}
        >
          <div
            className="mt-0.5 w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center"
            style={{
              background: terms ? "var(--lavanda)" : "#fff",
              borderColor: terms ? "var(--lavanda)" : "var(--gris-linea)",
            }}
          >
            {terms && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <span className="text-sm leading-snug" style={{ color: "var(--gris-texto)" }}>
            Acepto los{" "}
            <span className="underline" style={{ color: "var(--lavanda-dark)" }}>
              Términos y Condiciones
            </span>{" "}
            y la{" "}
            <span className="underline" style={{ color: "var(--lavanda-dark)" }}>
              Política de Privacidad
            </span>
          </span>
        </div>

        <Button
          type="submit"
          disabled={!terms || loading}
          className="w-full font-head font-medium"
          style={{ background: "var(--lavanda)", color: "#fff" }}
        >
          {loading ? "Creando cuenta..." : "Crear mi cuenta"}
        </Button>
      </form>

      <p className="text-sm text-center mt-4" style={{ color: "var(--gris-texto)" }}>
        ¿Ya tienes cuenta?{" "}
        <Link href="/auth/login" className="underline" style={{ color: "var(--lavanda-dark)" }}>
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
