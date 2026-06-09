import Link from "next/link";
import { getSeriesPillars } from "@/lib/admin/queries";

export default async function PillarsPage({
  params,
}: {
  params: Promise<{ programId: string; seriesId: string }>;
}) {
  const { programId, seriesId } = await params;
  const pillars = await getSeriesPillars(seriesId);
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-head text-xl mb-4">Pilares del mes</h1>
      <div className="space-y-2">
        {pillars.map((p) => (
          <Link key={p.pillar_key}
            href={`/admin/content/${programId}/series/${seriesId}/pillars/${p.pillar_key}`}
            className="flex items-center justify-between rounded-lg border px-4 py-3 font-body"
            style={{ borderColor: "var(--gris-linea)" }}>
            <span>{p.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: p.published ? "var(--lavanda-tint)" : "#f0f0f0",
                color: p.published ? "var(--lavanda-dark)" : "var(--gris-texto)" }}>
              {p.id ? (p.published ? "Publicado" : "Borrador") : "Sin crear"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
