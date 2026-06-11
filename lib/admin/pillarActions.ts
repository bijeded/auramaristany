"use server";
import { revalidatePath } from "next/cache";
import type { SaveBlockInput } from "./dayActions";
import { requireAdmin } from "./auth";
import { validateBlock, validatePillarInput } from "./content-validation";
import { sanitizeRichText } from "./sanitize-html";

export async function savePillar(data: {
  seriesId: string; pillarKey: string; title: string; published: boolean;
}): Promise<{ pillarId: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { pillarId: "", error: auth.error };
  const valid = validatePillarInput({ title: data.title });
  if (!valid.ok) return { pillarId: "", error: valid.error };
  const supabase = auth.supabase;
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
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  for (const b of blocks) {
    const v = validateBlock(b);
    if (!v.ok) return { error: v.error };
  }
  const { error: delErr } = await client.from("program_pillar_blocks").delete().eq("pillar_id", pillarId);
  if (delErr) return { error: delErr.message };
  if (blocks.length > 0) {
    const { error } = await client.from("program_pillar_blocks").insert(
      blocks.map((b, i) => ({
        pillar_id: pillarId,
        block_type: b.block_type,
        sort_order: i,
        content:
          b.block_type === "text" && typeof (b.content as { html?: unknown }).html === "string"
            ? { ...b.content, html: sanitizeRichText((b.content as { html: string }).html) }
            : b.content,
      }))
    );
    if (error) return { error: error.message };
  }
  revalidatePath("/portal/pilares");
  return {};
}
