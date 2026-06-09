import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { getSeriesPillars, getAdminProgram } from "@/lib/admin/queries";

export default async function PillarsPage({
  params,
}: {
  params: Promise<{ programId: string; seriesId: string }>;
}) {
  const { programId, seriesId } = await params;
  const result = await getAdminProgram(programId);
  if (!result) notFound();
  const { program } = result;
  const pillars = await getSeriesPillars(seriesId);
  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6 font-body" style={{ fontSize: 13, color: "var(--gris-suave)" }}>
        <Link href="/admin/content" style={{ color: "var(--gris-suave)", textDecoration: "none" }}>
          Contenido
        </Link>
        <ChevronRight size={14} />
        <Link href={`/admin/content/${programId}`} style={{ color: "var(--gris-suave)", textDecoration: "none" }}>
          {program.name}
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: "var(--negro)", fontWeight: 600 }}>Pilares</span>
      </nav>

      {/* Back link */}
      <Link href={`/admin/content/${programId}`}
        className="flex items-center gap-1 font-body mb-4" style={{ fontSize: 14, color: "var(--lavanda-dark)" }}>
        <ChevronLeft size={16} /> Volver a la serie
      </Link>

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
