import Stripe from "stripe";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

const variants = [
  { id: "00000000-0000-0000-0002-000000000001", slug: "cuarenta-mas-principiante-poco", name: "CuarentaMás Principiante Poco Tiempo" },
  { id: "00000000-0000-0000-0002-000000000002", slug: "cuarenta-mas-principiante-suf",  name: "CuarentaMás Principiante Tiempo Suficiente" },
  { id: "00000000-0000-0000-0002-000000000003", slug: "cuarenta-mas-intermedio-poco",   name: "CuarentaMás Intermedio Poco Tiempo" },
  { id: "00000000-0000-0000-0002-000000000004", slug: "cuarenta-mas-intermedio-suf",    name: "CuarentaMás Intermedio Tiempo Suficiente" },
  { id: "00000000-0000-0000-0002-000000000005", slug: "cuarenta-mas-avanzado-suf",      name: "CuarentaMás Avanzado Tiempo Suficiente" },
  { id: "00000000-0000-0000-0002-000000000006", slug: "cuarenta-mas-extra-intermedio",  name: "CuarentaMás Extra Intermedio" },
  { id: "00000000-0000-0000-0002-000000000007", slug: "cuarenta-mas-extra-avanzado",    name: "CuarentaMás Extra Avanzado" },
  { id: "00000000-0000-0000-0002-000000000008", slug: "strong-fit-principiante",        name: "Strong & Fit Principiante" },
  { id: "00000000-0000-0000-0002-000000000009", slug: "strong-fit-intermedio",          name: "Strong & Fit Intermedio" },
  { id: "00000000-0000-0000-0002-000000000010", slug: "strong-fit-avanzado",            name: "Strong & Fit Avanzado" },
];

async function main() {
  console.log("Creating Stripe Products and Prices (test mode)...\n");
  const sqlLines: string[] = [];

  for (const variant of variants) {
    const product = await stripe.products.create({
      name: variant.name,
      metadata: { variant_slug: variant.slug, variant_id: variant.id },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 99900,
      currency: "mxn",
      recurring: { interval: "month" },
      metadata: { variant_slug: variant.slug, variant_id: variant.id },
    });

    console.log(`✓ ${variant.slug}: ${price.id}`);
    sqlLines.push(
      `update program_variants set stripe_price_id = '${price.id}' where id = '${variant.id}';`
    );
  }

  console.log("\n-- Run this SQL in Supabase Dashboard → SQL Editor → New query:\n");
  sqlLines.forEach((line) => console.log(line));
  console.log("\n-- Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
