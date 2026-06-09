import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface PillarWithBlocks {
  id: string;
  pillar_key: string;
  title: string;
  blocks: { id: string; block_type: string; sort_order: number; content: Record<string, unknown> }[];
}

const ALLOWED = new Set(["cuarenta-mas", "cuarenta-mas-extra"]);

/**
 * True when the user has an active CuarentaMás/Extra subscription (the only
 * programs that expose the monthly pillars section in the portal).
 */
export async function hasPillarsAccess(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: rawSub } = await supabase
    .from("subscriptions")
    .select("program_variants!inner ( programs!inner ( slug ) )")
    .eq("profile_id", userId)
    .eq("status", "active")
    .single();

  const sub = rawSub as unknown as { program_variants: { programs: { slug: string } } } | null;
  return !!sub && ALLOWED.has(sub.program_variants.programs.slug);
}

export async function getCurrentMonthPillars(userId: string): Promise<PillarWithBlocks[]> {
  const supabase = await createClient();

  const { data: rawSub } = await supabase
    .from("subscriptions")
    .select(`months_elapsed, program_variant_id,
      program_variants!inner ( program_id, programs!inner ( slug ) )`)
    .eq("profile_id", userId)
    .eq("status", "active")
    .single();

  const sub = rawSub as unknown as {
    months_elapsed: number;
    program_variant_id: string;
    program_variants: { program_id: string; programs: { slug: string } };
  } | null;
  if (!sub) return [];
  if (!ALLOWED.has(sub.program_variants.programs.slug)) return [];

  const { data: rawMap } = await supabase
    .from("variant_series_map")
    .select("series_id, program_series!inner ( series_number )")
    .eq("program_variant_id", sub.program_variant_id);
  const map = rawMap as unknown as { series_id: string; program_series: { series_number: number } }[] | null;
  const seriesEntry = map?.find((m) => m.program_series.series_number === sub.months_elapsed);
  if (!seriesEntry) return [];

  const { data: rawPillars } = await supabase
    .from("program_series_pillars")
    .select("id, pillar_key, title")
    .eq("series_id", seriesEntry.series_id)
    .eq("published", true)
    .order("sort_order");
  const pillars = (rawPillars as unknown as { id: string; pillar_key: string; title: string }[]) ?? [];
  if (pillars.length === 0) return [];

  const { data: rawBlocks } = await supabase
    .from("program_pillar_blocks")
    .select("id, pillar_id, block_type, sort_order, content")
    .in("pillar_id", pillars.map((p) => p.id))
    .order("sort_order");
  const blocks =
    (rawBlocks as unknown as {
      id: string;
      pillar_id: string;
      block_type: string;
      sort_order: number;
      content: Record<string, unknown>;
    }[]) ?? [];

  return pillars.map((p) => ({
    ...p,
    blocks: blocks
      .filter((b) => b.pillar_id === p.id)
      .map((b) => {
        const { pillar_id, ...rest } = b;
        void pillar_id;
        return rest;
      }),
  }));
}
