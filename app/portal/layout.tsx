import { createClient } from "@/lib/supabase/server";
import { hasPillarsAccess } from "@/lib/content/pillars";
import { PortalNav } from "@/components/portal/PortalNav";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const showPilares = user ? await hasPillarsAccess(user.id) : false;

  return (
    <div style={{ background: "#e8e0e0", minHeight: "100dvh" }}>
      <div
        className="flex flex-col mx-auto"
        style={{ height: "100dvh", maxWidth: 640, background: "var(--rosa-soft)", boxShadow: "0 0 40px rgba(0,0,0,0.12)" }}
      >
        <main className="flex-1 overflow-y-auto">{children}</main>

        <PortalNav showPilares={showPilares} />
      </div>
    </div>
  );
}
