import { getAllPayments } from "@/lib/admin/finance-queries";
import { PaymentsTable } from "@/components/admin/PaymentsTable";
import { requireAdminPage } from "@/lib/admin/auth";

export default async function AdminPaymentsPage() {
  await requireAdminPage();
  const payments = await getAllPayments();
  return <PaymentsTable rows={payments} />;
}
