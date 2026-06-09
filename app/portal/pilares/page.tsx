import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";
import { PillarsView } from "@/components/portal/PillarsView";

export default async function PilaresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const pillars = await getCurrentMonthPillars(user.id);
  return <PillarsView pillars={pillars} />;
}
