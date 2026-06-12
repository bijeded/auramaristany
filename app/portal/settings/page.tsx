import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function PortalSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .single();

  const p = (profile ?? {}) as { full_name?: string | null; email?: string | null; phone?: string | null };
  const rows: { label: string; value: string }[] = [
    { label: "Nombre", value: p.full_name || "—" },
    { label: "Correo", value: p.email || user.email || "—" },
    { label: "Teléfono", value: p.phone || "—" },
  ];

  return (
    <div className="p-5">
      <h1 className="font-head text-xl mb-5" style={{ color: "var(--negro)" }}>
        Configuración
      </h1>

      <div className="rounded-xl bg-white p-5 mb-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h2 className="font-head text-sm uppercase tracking-wider mb-4" style={{ color: "var(--gris-suave)" }}>
          Tu cuenta
        </h2>
        <dl className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4">
              <dt className="font-body text-sm" style={{ color: "var(--gris-texto)" }}>
                {r.label}
              </dt>
              <dd className="font-body text-sm font-medium text-right" style={{ color: "var(--negro)" }}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <LogoutButton />
    </div>
  );
}
