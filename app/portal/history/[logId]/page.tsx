import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHistoryLog } from "@/lib/content/history";
import { HistoryDayView } from "@/components/portal/HistoryDayView";

export default async function HistoryDetailPage({
  params,
}: {
  params: { logId: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const detail = await getHistoryLog(user.id, params.logId);
  if (!detail) notFound();

  return <HistoryDayView detail={detail} />;
}
