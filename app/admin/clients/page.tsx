import { getClientsList } from "@/lib/admin/clients-queries";
import { ClientsTable } from "@/components/admin/ClientsTable";

export default async function AdminClientsPage() {
  const rows = await getClientsList();
  return <ClientsTable rows={rows} />;
}
