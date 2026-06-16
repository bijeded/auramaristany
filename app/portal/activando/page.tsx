"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_ATTEMPTS = 15; // 30 seconds (2s interval)

export default function ActivandoPage() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const attemptsRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();

    const check = async () => {
      attemptsRef.current += 1;

      if (attemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(interval);
        setTimedOut(true);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        clearInterval(interval);
        router.replace("/auth/login");
        return;
      }

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("profile_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (sub) {
        clearInterval(interval);
        const { data: rawProfile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        // rawProfile typed by client's DB type; profile.onboarding_completed is boolean.
        const profile = rawProfile;

        router.replace(
          profile?.onboarding_completed ? "/portal/today" : "/onboarding/questionnaire"
        );
      }
    };

    const interval = setInterval(check, 2000);
    check();

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (timedOut) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: "var(--rosa-soft)" }}
      >
        <span
          className="font-head text-2xl font-semibold tracking-widest uppercase mb-8"
          style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
        >
          AURA
        </span>
        <div
          className="rounded-xl bg-white p-8 text-center w-full max-w-sm"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h1 className="font-head text-xl mb-3" style={{ color: "var(--negro)" }}>
            Algo tardó más de lo esperado
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--gris-texto)" }}>
            Tu pago fue procesado. Si no tienes acceso en unos minutos, contáctanos.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 rounded-lg font-body text-sm font-semibold text-white"
            style={{ background: "var(--lavanda)" }}
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--rosa-soft)" }}
    >
      <span
        className="font-head text-2xl font-semibold tracking-widest uppercase mb-8"
        style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
      >
        AURA
      </span>
      <div
        className="rounded-xl bg-white p-8 text-center w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex justify-center mb-6">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: "var(--lavanda)", borderTopColor: "transparent" }}
          />
        </div>
        <h1 className="font-head text-xl mb-2" style={{ color: "var(--negro)" }}>
          Activando tu suscripción…
        </h1>
        <p className="text-sm" style={{ color: "var(--gris-texto)" }}>
          Esto tarda unos segundos. No cierres esta ventana.
        </p>
      </div>
    </div>
  );
}
