import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";
import { PillarsView } from "@/components/portal/PillarsView";

function formatDate(isoDate: string): string {
  // T12:00:00 avoids midnight-UTC → prior-day in negative-offset timezones
  const str = new Date(`${isoDate}T12:00:00`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default async function PilaresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const pillars = await getCurrentMonthPillars(user.id);
  // Same date logic as /today (respects DEV_DATE override in dev).
  const isoToday = (
    process.env.DEV_DATE
      ? new Date(`${process.env.DEV_DATE}T12:00:00`)
      : new Date()
  )
    .toISOString()
    .split("T")[0];
  return <PillarsView pillars={pillars} dateLabel={formatDate(isoToday)} />;
}
