import { getClientsList } from "@/lib/admin/clients-queries";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { requireAdminPage } from "@/lib/admin/auth";
import { serverToday } from "@/lib/content/server-today";

export default async function AdminClientsPage() {
  await requireAdminPage();
  const rows = await getClientsList();
  // "Hoy" date-only, mismo origen que lib/content/queries.ts.
  const now = serverToday().toISOString().split("T")[0];
  // D24 — los filtros (?status=, ?program=) los lee ClientsTable de la URL en
  // cada render; el deep link de D17 del dashboard entra por la misma vía.
  return <ClientsTable rows={rows} now={now} />;
}
