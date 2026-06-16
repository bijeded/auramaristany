import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PlusCircle } from "lucide-react";
import { getAdminProgram } from "@/lib/admin/queries";
import { SeriesAccordion } from "@/components/admin/SeriesAccordion";

export default async function AdminProgramPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const result = await getAdminProgram(programId);

  if (!result) notFound();

  const { program, series, variants } = result;

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6 font-body" style={{ fontSize: 13, color: "var(--gris-suave)" }}>
        <Link href="/admin/content" style={{ color: "var(--gris-suave)", textDecoration: "none" }}>
          Contenido
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: "var(--negro)", fontWeight: 600 }}>{program.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-head" style={{ fontSize: 26, fontWeight: 700 }}>
            {program.name}
          </h1>
          <p className="font-body mt-1" style={{ fontSize: 14, color: "var(--gris-texto)" }}>
            {series.length} {series.length === 1 ? "serie" : "series"} ·{" "}
            {program.duration_months ? `${program.duration_months} meses de contenido` : "Programa continuo"}
          </p>
        </div>
        <button
          disabled
          title="Disponible en Subsistema F — mapeo de variantes"
          className="flex items-center gap-2 font-body rounded-xl px-4 py-2"
          style={{
            fontSize: 13,
            fontWeight: 600,
            background: "var(--lavanda-tint)",
            color: "var(--lavanda-dark)",
            border: "none",
            cursor: "not-allowed",
            opacity: 0.5,
          }}
        >
          <PlusCircle size={16} />
          Nueva serie
        </button>
      </div>

      {/* Series list */}
      {series.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ border: "1.5px dashed var(--gris-linea)", background: "#fff" }}
        >
          <p className="font-head" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Sin series todavía
          </p>
          <p className="font-body" style={{ fontSize: 14, color: "var(--gris-texto)" }}>
            Crea la primera serie para empezar a cargar contenido.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {series.map((s, i) => (
            <SeriesAccordion
              key={s.id}
              series={s}
              programId={programId}
              programSlug={program.slug}
              defaultOpen={i === series.length - 1}
              variants={variants}
            />
          ))}
        </div>
      )}
    </div>
  );
}
