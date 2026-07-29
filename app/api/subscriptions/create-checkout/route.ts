import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

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

  const { data: variantRaw } = await supabase
    .from("program_variants")
    .select("id, name, stripe_price_id")
    .eq("slug", variantSlug)
    .eq("is_active", true)
    .single();

  const variant = variantRaw as VariantResult | null;

  if (!variant) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  // L2c — aquí NO hay puerta de elegibilidad. Los prerequisitos sembrados
  // codificaban una regla de CONTENIDO ("Extra va después de CuarentaMás")
  // mientras Aura aplica una de JUICIO: evalúa a la clienta en su sitio y la
  // manda al checkout del nivel que le corresponde. No se reconcilian —la regla
  // de la base rechazaba justo a quien ella había aprobado, incluida una
  // clienta sin ninguna suscripción previa mandada directa a Avanzado—. La
  // puerta es el embudo; la migración 017 borra las filas.
  //
  // Contrapartida aceptada: cualquiera con la URL de un checkout puede
  // suscribirse a cualquier nivel. Si la autoselección llega a ser un problema
  // real —es fuerza para mujeres de 40+ y el nivel es seguridad—, el sustituto
  // es un registro de aprobación que emita Aura, no volver a deducirlo del
  // contenido.

  const { data: profileRaw } = await supabase
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
    await supabase
      .from("profiles")
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
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/portal/activando`,
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
