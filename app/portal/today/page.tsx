import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTodayContent } from "@/lib/content/queries";
import { getBookingState } from "@/lib/content/booking-queries";
import { TodayView } from "@/components/portal/TodayView";

export default async function PortalTodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const content = await getTodayContent(user.id);
  // Estado de reserva para el bloque "agendar" (si el día lo incluye).
  const booking = await getBookingState(user.id);

  return <TodayView content={content} booking={booking} />;
}
