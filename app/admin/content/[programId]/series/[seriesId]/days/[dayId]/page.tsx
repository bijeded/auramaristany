import { notFound } from "next/navigation";
import { getDayWithBlocks } from "@/lib/admin/queries";
import { DayEditorForm } from "@/components/admin/DayEditorForm";

export default async function EditDayPage({
  params,
}: {
  params: Promise<{ programId: string; seriesId: string; dayId: string }>;
}) {
  const { programId, seriesId, dayId } = await params;
  const day = await getDayWithBlocks(dayId);
  if (!day) notFound();
  return (
    <div className="p-6">
      <h1 className="font-head text-xl mb-4">Editar día</h1>
      <DayEditorForm day={day} seriesId={seriesId} programId={programId}
        weekNumber={day.week_number} dayOfWeek={day.day_of_week} />
    </div>
  );
}
