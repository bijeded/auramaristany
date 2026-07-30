import { getClientsList } from "@/lib/admin/clients-queries";
import { parseStatusFilter } from "@/lib/admin/clients-helpers";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { requireAdminPage } from "@/lib/admin/auth";
import { serverToday } from "@/lib/content/server-today";

export default async function AdminClientsPage({
  searchParams,
}: {
  // Next 14: searchParams es un objeto plano, no una promesa.
  searchParams?: { status?: string | string[] };
}) {
  await requireAdminPage();
  const rows = await getClientsList();
  // "Hoy" date-only, mismo origen que lib/content/queries.ts.
  const now = serverToday().toISOString().split("T")[0];
  // D17 — las tarjetas "Terminan"/"Cancelaciones" del dashboard llegan con la
  // cohorte en la URL. Se valida contra la lista: un valor inventado no entra.
  const initialStatus = parseStatusFilter(searchParams?.status);
  return <ClientsTable rows={rows} now={now} initialStatus={initialStatus} />;
}
