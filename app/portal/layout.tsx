import { createClient } from "@/lib/supabase/server";
import { hasPillarsAccess } from "@/lib/content/pillars";
import { getUnreadCount } from "@/lib/content/messages";
import { PortalNav } from "@/components/portal/PortalNav";
import { PaymentPendingBanner } from "@/components/portal/PaymentPendingBanner";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [showPilares, unreadMessages] = user
    ? await Promise.all([hasPillarsAccess(user.id), getUnreadCount(user.id)])
    : [false, 0];
  const { data: pastDue } = user
    ? await supabase.from("subscriptions").select("id").eq("profile_id", user.id).eq("status", "past_due").maybeSingle()
    : { data: null };

  return (
    <div style={{ background: "#e8e0e0", minHeight: "100dvh" }}>
      <div
        className="flex flex-col mx-auto"
        style={{ height: "100dvh", maxWidth: 640, background: "var(--rosa-soft)", boxShadow: "0 0 40px rgba(0,0,0,0.12)" }}
      >
        {pastDue ? <PaymentPendingBanner /> : null}
        <main className="flex-1 overflow-y-auto">{children}</main>

        <PortalNav showPilares={showPilares} unreadMessages={unreadMessages} />
      </div>
    </div>
  );
}
