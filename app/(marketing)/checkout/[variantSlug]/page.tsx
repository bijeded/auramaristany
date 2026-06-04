import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutButton } from "./CheckoutButton";

interface PageProps {
  params: Promise<{ variantSlug: string }>;
}

interface VariantRow {
  id: string;
  name: string;
  price_mxn: number;
  programs: {
    name: string;
    billing_model: string;
    duration_months: number | null;
  } | null;
}

export default async function CheckoutPage({ params }: PageProps) {
  const { variantSlug } = await params;
  const supabase = await createClient();

  const { data: variantRaw } = await supabase
    .from("program_variants")
    .select("id, name, price_mxn, programs(name, billing_model, duration_months)")
    .eq("slug", variantSlug)
    .eq("is_active", true)
    .single();

  const variant = variantRaw as VariantRow | null;

  if (!variant) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const program = variant.programs;

  const durationLabel =
    program?.billing_model === "fixed_term_monthly" && program.duration_months
      ? `${program.duration_months} meses`
      : "Mensual sin fecha de vencimiento";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--rosa-soft)" }}
    >
      <span
        className="font-head text-2xl font-semibold tracking-widest uppercase mb-8"
        style={{ color: "var(--negro)", letterSpacing: "0.2em" }}
      >
        AURA
      </span>

      <div
        className="rounded-xl bg-white p-8 w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <p
          className="text-xs uppercase tracking-widest mb-1 font-head"
          style={{ color: "var(--gris-suave)" }}
        >
          {program?.name}
        </p>
        <h1 className="font-head text-xl mb-1">{variant.name}</h1>
        <p className="text-sm mb-4" style={{ color: "var(--gris-texto)" }}>
          {durationLabel}
        </p>
        <p className="font-head text-3xl mb-6">
          ${Number(variant.price_mxn).toLocaleString("es-MX")}{" "}
          <span className="text-base font-body" style={{ color: "var(--gris-texto)" }}>
            MXN/mes
          </span>
        </p>

        {user ? (
          <CheckoutButton variantSlug={variantSlug} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-center mb-2" style={{ color: "var(--gris-texto)" }}>
              Necesitas una cuenta para continuar
            </p>
            <a
              href={`/auth/register?next=/checkout/${variantSlug}`}
              className="block w-full text-center py-3 rounded-lg font-head uppercase tracking-wider text-sm text-white"
              style={{ background: "var(--lavanda)" }}
            >
              Crear cuenta
            </a>
            <a
              href={`/auth/login?next=/checkout/${variantSlug}`}
              className="block w-full text-center py-3 rounded-lg font-head uppercase tracking-wider text-sm"
              style={{ border: "1px solid var(--lavanda)", color: "var(--lavanda)" }}
            >
              Ya tengo cuenta
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
