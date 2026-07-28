import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getAdminProgram } from "@/lib/admin/queries";
import { SeriesAccordion } from "@/components/admin/SeriesAccordion";
import { NewSeriesButton } from "@/components/admin/NewSeriesButton";

export default async function AdminProgramPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const result = await getAdminProgram(programId);

  if (!result) notFound();

  const { program, curricula, variants, seriesCount } = result;

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-2 mb-6 font-body"
        style={{ fontSize: 13, color: "var(--gris-suave)" }}
      >
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
            {seriesCount} {seriesCount === 1 ? "serie" : "series"} en{" "}
            {variants.length} {variants.length === 1 ? "variante" : "variantes"} ·{" "}
            {program.duration_months
              ? `${program.duration_months} meses de contenido`
              : "Programa continuo"}
          </p>
        </div>
        <NewSeriesButton programId={programId} variants={variants} />
      </div>

      {/* Un currículo por variante: cada nivel numera sus meses desde 1 */}
      <div className="flex flex-col gap-10">
        {curricula.map((variant) => (
          <section key={variant.id}>
            <h2
              className="font-head mb-3"
              style={{ fontSize: 17, fontWeight: 700, color: "var(--negro)" }}
            >
              {variant.name}
              <span
                className="font-body ml-2"
                style={{ fontSize: 13, fontWeight: 400, color: "var(--gris-suave)" }}
              >
                {variant.series.length}{" "}
                {variant.series.length === 1 ? "mes" : "meses"}
              </span>
            </h2>

            {variant.series.length === 0 ? (
              <div
                className="rounded-xl p-6 text-center"
                style={{ border: "1.5px dashed var(--gris-linea)", background: "#fff" }}
              >
                <p className="font-body" style={{ fontSize: 14, color: "var(--gris-texto)" }}>
                  Sin contenido todavía. Crea el Mes 1 de esta variante.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {variant.series.map((s, i) => (
                  <SeriesAccordion
                    key={`${variant.id}:${s.id}`}
                    series={s}
                    programId={programId}
                    programSlug={program.slug}
                    variants={variants}
                    defaultOpen={i === variant.series.length - 1}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
