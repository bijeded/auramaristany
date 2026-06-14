import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountData } from "@/lib/portal/account-queries";
import { paginate } from "@/lib/admin/pagination";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProfileHeader } from "@/components/portal/settings/ProfileHeader";
import { SubscriptionCard } from "@/components/portal/settings/SubscriptionCard";
import { SecuritySection } from "@/components/portal/settings/SecuritySection";
import { PaymentHistory } from "@/components/portal/settings/PaymentHistory";

// Etiqueta de fecha para el PortalHeader (respeta DEV_DATE en dev, como /pilares).
function todayLabel(): string {
  const base = process.env.DEV_DATE ? new Date(`${process.env.DEV_DATE}T12:00:00`) : new Date();
  return base.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-head text-xs uppercase tracking-wider" style={{ color: "var(--gris-suave)", margin: "22px 0 10px" }}>
      {children}
    </h2>
  );
}

export default async function PortalSettingsPage({
  searchParams,
}: { searchParams: { page?: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const data = await getAccountData(user.id);
  const { items, page, totalPages } = paginate(data.invoices, Number(searchParams.page) || 1, 10);

  return (
    <>
      <PortalHeader dateLabel={todayLabel()} />
      <div className="p-5">
        <h1 className="font-head text-xl mb-2" style={{ color: "var(--negro)" }}>Mi cuenta</h1>

        <ProfileHeader
          fullName={data.profile.full_name}
          email={data.profile.email || user.email || ""}
          phone={data.profile.phone}
          avatarUrl={data.profile.avatar_url}
        />

        <SectionTitle>Mi programa</SectionTitle>
        <SubscriptionCard subscription={data.subscription} />

        <SectionTitle>Seguridad</SectionTitle>
        <SecuritySection />

        <div id="pagos" />
        <SectionTitle>Historial de pagos</SectionTitle>
        <PaymentHistory invoices={items} page={page} totalPages={totalPages} />

        <div style={{ marginTop: 24 }}>
          <LogoutButton />
        </div>
      </div>
    </>
  );
}
