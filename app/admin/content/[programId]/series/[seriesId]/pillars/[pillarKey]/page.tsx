import { notFound } from "next/navigation";
import { getPillarWithBlocks, PILLARS } from "@/lib/admin/queries";
import { PillarEditorForm } from "@/components/admin/PillarEditorForm";
import { requireAdminPage } from "@/lib/admin/auth";

export default async function PillarEditPage({
  params,
}: {
  params: Promise<{ programId: string; seriesId: string; pillarKey: string }>;
}) {
  await requireAdminPage();
  const { programId, seriesId, pillarKey } = await params;
  if (!PILLARS.some((p) => p.key === pillarKey)) notFound();
  const pillar = await getPillarWithBlocks(seriesId, pillarKey);
  const pillarName = PILLARS.find((p) => p.key === pillarKey)!.name;
  return (
    <div className="p-6">
      <PillarEditorForm seriesId={seriesId} programId={programId}
        pillarKey={pillarKey} pillarName={pillarName} pillar={pillar} />
    </div>
  );
}
