/**
 * Backfill de invoices pagados faltantes desde Stripe.
 * Uso:  npx tsx --env-file=.env.local scripts/backfill-first-invoices.ts [--dry-run]
 * Idempotente: sólo inserta invoices cuyo stripe_invoice_id no exista aún.
 *
 * Nota: los módulos lib/stripe.ts y lib/supabase/service.ts contienen
 * `import "server-only"` que lanza un error en contextos Node puros.
 * Los clientes se instancian aquí directamente (mismo patrón que seed-stripe.ts).
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id");
  if (error) throw error;

  const { data: existing } = await supabase.from("invoices").select("stripe_invoice_id");
  const known = new Set((existing ?? []).map((r: { stripe_invoice_id: string }) => r.stripe_invoice_id));

  let inserted = 0;
  for (const sub of subs ?? []) {
    if (!sub.stripe_subscription_id) continue;
    const invoices = await stripe.invoices.list({ subscription: sub.stripe_subscription_id, limit: 100 });
    for (const inv of invoices.data) {
      if (inv.status !== "paid" || !inv.id || known.has(inv.id)) continue;
      const payload = {
        subscription_id: sub.id,
        stripe_invoice_id: inv.id,
        amount_paid: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        invoice_date: new Date(inv.created * 1000).toISOString().split("T")[0],
      };
      console.log(`${dryRun ? "[dry-run] " : ""}insert invoice ${inv.id} ($${payload.amount_paid}) sub ${sub.id}`);
      if (!dryRun) {
        const { error: insErr } = await supabase.from("invoices").insert(payload);
        if (insErr) console.error("  insert error:", insErr.message);
        else { inserted += 1; known.add(inv.id); }
      }
    }
  }
  console.log(`Listo. ${dryRun ? "(dry-run) " : ""}invoices insertados: ${inserted}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
