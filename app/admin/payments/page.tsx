import { getAllPayments } from "@/lib/admin/finance-queries";
import { PaymentsTable } from "@/components/admin/PaymentsTable";

export default async function AdminPaymentsPage() {
  const payments = await getAllPayments();
  return <PaymentsTable rows={payments} />;
}
