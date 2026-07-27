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
  const { data, error } = await supabase
    .from("automated_messages")
    .select("rule, subject, body, is_active")
    .order("rule");
  // Sin filas la pantalla cae al estado vacío; el motivo real sólo aparece aquí.
  if (error) console.error("[AdminAutomatedMessagesPage]", error);

  // keep: el select parcial no estrecha `rule` de string a NoticeRule.
  const rows = (data ?? []) as AutomatedMessageRow[];
  return <AutomatedMessagesEditor rows={rows} />;
}
