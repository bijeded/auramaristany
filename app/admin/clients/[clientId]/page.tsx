import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/admin/clients-queries";
import { ClientDetailTabs } from "@/components/admin/ClientDetailTabs";
import { requireAdminPage } from "@/lib/admin/auth";

export default async function AdminClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  await requireAdminPage();
  const detail = await getClientDetail(params.clientId);
  if (!detail) notFound();
  return <ClientDetailTabs detail={detail} />;
}
