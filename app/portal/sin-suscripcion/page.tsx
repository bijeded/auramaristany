import { LogoutButton } from "@/components/auth/LogoutButton";

export default function SinSuscripcionPage() {
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
        <h1 className="font-head text-xl mb-2">Sin suscripción activa</h1>
        <p className="text-sm mb-6" style={{ color: "var(--gris-texto)" }}>
          Necesitas una suscripción activa para acceder al portal. Regresa al
          cuestionario de nivel en el sitio de Aura para elegir tu programa.
        </p>
        <a
          href="https://demo.studiosdmm.com.mx/aura/"
          className="block w-full text-center py-3 rounded-lg font-head uppercase tracking-wider text-sm text-white mb-3"
          style={{ background: "var(--lavanda)" }}
        >
          Ir al sitio de Aura
        </a>
        <LogoutButton />
      </div>
    </div>
  );
}
