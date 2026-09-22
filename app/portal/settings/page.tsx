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
import { CancelSubscriptionSection } from "@/components/portal/settings/CancelSubscriptionSection";
import { GraduatedCard } from "@/components/portal/settings/GraduatedCard";
import { deriveCancellationState } from "@/lib/portal/cancellation";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import { weekdayLabel } from "@/lib/admin/date-helpers";

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

  const cancelState = data.subscription
    ? deriveCancellationState({
        // keep: AccountSubscription.status is typed string (join-mapped); the DB constrains
        // it to the SubscriptionStatus union and deriveCancellationState reads known values.
        status: data.subscription.status as SubscriptionStatus,
        cancelAtPeriodEnd: data.subscription.cancel_at_period_end,
        currentPeriodEnd: data.subscription.current_period_end,
        completedAt: data.subscription.completed_at,
      })
    : { kind: "none" as const };

  return (
    <>
      <PortalHeader dateLabel={weekdayLabel()} />
      <div className="p-5">
        <h1 className="font-head text-xl mb-2" style={{ color: "var(--negro)" }}>Mi cuenta</h1>

        <ProfileHeader
          fullName={data.profile.full_name}
          email={data.profile.email || user.email || ""}
          phone={data.profile.phone}
          avatarUrl={data.profile.avatar_url}
        />

        {cancelState.kind === "completed" && data.subscription && (
          <GraduatedCard
            programName={data.subscription.program_name}
            rungLevel={data.subscription.rung_level}
          />
        )}

        <SectionTitle>Mi suscripción</SectionTitle>
        <SubscriptionCard subscription={data.subscription} state={cancelState} />

        <SectionTitle>Seguridad</SectionTitle>
        <SecuritySection />

        <div id="pagos" />
        <SectionTitle>Historial de pagos</SectionTitle>
        <PaymentHistory invoices={items} page={page} totalPages={totalPages} />

        <div style={{ marginTop: 24 }} className="space-y-3">
          <LogoutButton />
          <CancelSubscriptionSection state={cancelState} />
        </div>
      </div>
    </>
  );
}
