import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";
import { PillarsView } from "@/components/portal/PillarsView";
import { weekdayLabel } from "@/lib/admin/date-helpers";
import { serverToday } from "@/lib/content/server-today";

export default async function PilaresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const pillars = await getCurrentMonthPillars(user.id);
  // Same date logic as /today.
  const isoToday = serverToday().toISOString().split("T")[0];
  return <PillarsView pillars={pillars} dateLabel={weekdayLabel(isoToday)} />;
}
