import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  pickPrimarySubscription,
  type ClientListRow,
  type SubStatus,
} from "./clients-helpers";

interface RawSubRow {
  profile_id: string;
  status: SubStatus;
  current_period_end: string | null;
  enrollment_date: string;
  created_at: string;
  profiles: { full_name: string; email: string; phone: string | null } | null;
  program_variants: { name: string; price_mxn: number; programs: { name: string } | null } | null;
}

export async function getClientsList(): Promise<ClientListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "profile_id, status, current_period_end, enrollment_date, created_at, profiles(full_name, email, phone), program_variants(name, price_mxn, programs(name))"
    );

  const rows = ((data ?? []) as unknown as RawSubRow[]).filter(
    (r) => r.profiles && r.program_variants
  );

  const byProfile = new Map<string, RawSubRow[]>();
  for (const r of rows) {
    const list = byProfile.get(r.profile_id) ?? [];
    list.push(r);
    byProfile.set(r.profile_id, list);
  }

  const result: ClientListRow[] = [];
  for (const subs of Array.from(byProfile.values())) {
    const primary = pickPrimarySubscription(subs) as RawSubRow | null;
    if (!primary) continue;
    result.push({
      profile_id: primary.profile_id,
      full_name: primary.profiles!.full_name,
      email: primary.profiles!.email,
      phone: primary.profiles!.phone,
      program_name: primary.program_variants!.programs?.name ?? "—",
      variant_name: primary.program_variants!.name,
      enrollment_date: primary.enrollment_date,
      current_period_end: primary.current_period_end,
      price_mxn: primary.program_variants!.price_mxn,
      status: primary.status,
    });
  }

  result.sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  return result;
}
