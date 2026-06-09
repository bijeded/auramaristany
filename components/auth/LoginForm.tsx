"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Correo o contraseña incorrectos. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    const next = searchParams.get("next");
    const redirectTo = next && next.startsWith("/") ? next : "/portal/today";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-7" style={{ boxShadow: "var(--shadow-card)" }}>
      <h1 className="font-head text-2xl font-semibold text-center mb-1">Bienvenida de vuelta</h1>
      <p className="text-sm text-center mb-6" style={{ color: "var(--gris-texto)" }}>
        Ingresa con tu correo electrónico
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
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--error)" }}>
            {error}
          </p>
        )}

        <div className="text-right">
          <Link
            href="/auth/reset-password"
            className="text-sm underline"
            style={{ color: "var(--lavanda-dark)" }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full font-head font-medium"
          style={{ background: "var(--lavanda)", color: "#fff" }}
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: "var(--gris-linea)" }} />
        <span className="text-sm" style={{ color: "var(--gris-texto)" }}>o</span>
        <div className="flex-1 h-px" style={{ background: "var(--gris-linea)" }} />
      </div>

      <p className="text-sm text-center" style={{ color: "var(--gris-texto)" }}>
        ¿No tienes cuenta?{" "}
        <Link href="/auth/register" className="underline" style={{ color: "var(--lavanda-dark)" }}>
          Regístrate aquí
        </Link>
      </p>
    </div>
  );
}
