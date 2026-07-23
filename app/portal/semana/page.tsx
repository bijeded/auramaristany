import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWeekCalendar } from "@/lib/content/queries";
import { WeekView } from "@/components/portal/WeekView";

export default async function PortalSemanaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const rows = await getWeekCalendar(user.id);

  return <WeekView rows={rows} />;
}
