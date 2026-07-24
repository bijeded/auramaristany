import { getClientsList } from "@/lib/admin/clients-queries";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { requireAdminPage } from "@/lib/admin/auth";

export default async function AdminClientsPage() {
  await requireAdminPage();
  const rows = await getClientsList();
  // "Hoy" date-only, respetando DEV_DATE en desarrollo (igual que lib/content/queries.ts).
  const today = process.env.DEV_DATE
    ? new Date(`${process.env.DEV_DATE}T12:00:00`)
    : new Date();
  const now = today.toISOString().split("T")[0];
  return <ClientsTable rows={rows} now={now} />;
}
