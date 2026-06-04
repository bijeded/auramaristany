"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CheckoutButton({ variantSlug }: { variantSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar el pago");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Error de red. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
      <Button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full font-head uppercase tracking-wider"
        style={{ background: "var(--lavanda)", color: "#fff" }}
      >
        {loading ? "Redirigiendo al pago..." : "Continuar al pago"}
      </Button>
    </div>
  );
}
