import { getClientsList } from "@/lib/admin/clients-queries";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { requireAdminPage } from "@/lib/admin/auth";

export default async function AdminClientsPage() {
  await requireAdminPage();
  const rows = await getClientsList();
  return <ClientsTable rows={rows} />;
}
