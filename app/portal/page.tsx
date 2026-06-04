import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--rosa-soft)" }}
    >
      <span
        className="font-head text-2xl font-semibold tracking-widest uppercase mb-6"
        style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
      >
        AURA
      </span>
      <div
        className="rounded-xl bg-white p-8 text-center w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <h1 className="font-head text-xl mb-2">Portal</h1>
        <p className="text-sm mb-1" style={{ color: "var(--gris-texto)" }}>
          Sesión activa:
        </p>
        <p className="text-sm font-medium mb-6">{user.email}</p>
        <LogoutButton />
      </div>
    </div>
  );
}
