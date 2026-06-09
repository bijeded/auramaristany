"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SaveBlockInput } from "./dayActions";

export async function savePillar(data: {
  seriesId: string; pillarKey: string; title: string; published: boolean;
}): Promise<{ pillarId: string; error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("program_series_pillars")
    .upsert(
      { series_id: data.seriesId, pillar_key: data.pillarKey, title: data.title, published: data.published },
      { onConflict: "series_id,pillar_key" }
    )
    .select("id").single();
  if (error) return { pillarId: "", error: error.message };
  return { pillarId: row.id };
}

export async function savePillarBlocks(pillarId: string, blocks: SaveBlockInput[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error: delErr } = await client.from("program_pillar_blocks").delete().eq("pillar_id", pillarId);
  if (delErr) return { error: delErr.message };
  if (blocks.length > 0) {
    const { error } = await client.from("program_pillar_blocks").insert(
      blocks.map((b, i) => ({ pillar_id: pillarId, block_type: b.block_type, sort_order: i, content: b.content }))
    );
    if (error) return { error: error.message };
  }
  revalidatePath("/portal/pilares");
  return {};
}
