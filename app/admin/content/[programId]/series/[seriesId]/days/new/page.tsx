import { DayEditorForm } from "@/components/admin/DayEditorForm";

export default async function NewDayPage({
  params, searchParams,
}: {
  params: Promise<{ programId: string; seriesId: string }>;
  searchParams: Promise<{ week?: string; dow?: string }>;
}) {
  const { programId, seriesId } = await params;
  const { week, dow } = await searchParams;
  return (
    <div className="p-6">
      <h1 className="font-head text-xl mb-4">Nuevo día</h1>
      <DayEditorForm day={null} seriesId={seriesId} programId={programId}
        weekNumber={Number(week ?? 1)} dayOfWeek={dow ?? "lunes"} />
    </div>
  );
}
