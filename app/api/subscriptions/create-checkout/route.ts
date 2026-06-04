import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import { checkPrerequisites } from "@/lib/subscriptions/prerequisites";
import type { PrerequisiteRow, ClientSubscription } from "@/lib/subscriptions/prerequisites";

interface VariantResult {
  id: string;
  name: string;
  stripe_price_id: string | null;
}

interface ProfileResult {
  stripe_customer_id: string | null;
  full_name: string;
  email: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { variantSlug } = body;

  if (!variantSlug || typeof variantSlug !== "string") {
    return NextResponse.json({ error: "variantSlug requerido" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: variantRaw } = await service
    .from("program_variants")
    .select("id, name, stripe_price_id")
    .eq("slug", variantSlug)
    .eq("is_active", true)
    .single();

  const variant = variantRaw as VariantResult | null;

  if (!variant) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  const { data: prereqRows } = await service
    .from("program_variant_prerequisites")
    .select("prerequisite_group, required_program_slug, required_variant_levels, required_status")
    .eq("program_variant_id", variant.id);

  if (prereqRows && prereqRows.length > 0) {
    const { data: clientSubs } = await service
      .from("subscriptions")
      .select("status, program_variants(level, programs(slug))")
      .eq("profile_id", user.id)
      .in("status", ["active", "completed"]);

    const mapped: ClientSubscription[] = (clientSubs ?? []).map((s: any) => ({
      program_slug: s.program_variants?.programs?.slug ?? "",
      variant_level: s.program_variants?.level ?? null,
      status: s.status,
    }));

    const check = checkPrerequisites(prereqRows as PrerequisiteRow[], mapped);
    if (!check.allowed) {
      return NextResponse.json(
        { error: "No cumples los prerequisitos para este programa" },
        { status: 403 }
      );
    }
  }

  const { data: profileRaw } = await service
    .from("profiles")
    .select("stripe_customer_id, full_name, email")
    .eq("id", user.id)
    .single();

  const profile = profileRaw as ProfileResult | null;

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await (service
      .from("profiles") as any)
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  if (!variant.stripe_price_id) {
    return NextResponse.json(
      { error: "Precio de Stripe no configurado para esta variante" },
      { status: 500 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: variant.stripe_price_id, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/today`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${variantSlug}`,
    metadata: {
      supabase_user_id: user.id,
      variant_id: variant.id,
      variant_slug: variantSlug,
    },
    subscription_data: {
      metadata: { supabase_user_id: user.id, variant_id: variant.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
