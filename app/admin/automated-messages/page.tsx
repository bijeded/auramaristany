import { createClient } from "@/lib/supabase/server";
import { requireAdminPage } from "@/lib/admin/auth";
import {
  AutomatedMessagesEditor,
  type AutomatedMessageRow,
} from "@/components/admin/AutomatedMessagesEditor";

export default async function AdminAutomatedMessagesPage() {
  await requireAdminPage();
  // Cliente con RLS: la política de `automated_messages` ya es sólo-admin.
  const supabase = await createClient();
  const { data } = await supabase
    .from("automated_messages")
    .select("rule, subject, body, is_active")
    .order("rule");

  // Tipado por el SDK desde la Row de automated_messages.
  const rows = (data ?? []) as AutomatedMessageRow[];
  return <AutomatedMessagesEditor rows={rows} />;
}
