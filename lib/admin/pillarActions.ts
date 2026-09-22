"use server";
import { revalidatePath } from "next/cache";
import type { SaveBlockInput } from "./dayActions";
import { requireAdmin } from "./auth";
import { validateBlock, validatePillarInput } from "./content-validation";
import { sanitizeRichText } from "./sanitize-html";
import { logAndGeneric } from "./errors";
import type { Json } from "@/lib/supabase/types";

export async function savePillar(data: {
  seriesId: string; pillarKey: string; title: string; published: boolean;
}): Promise<{ pillarId: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { pillarId: "", error: auth.error };
  const valid = validatePillarInput({ title: data.title });
  if (!valid.ok) return { pillarId: "", error: valid.error };
  const supabase = auth.supabase;
  const { data: row, error } = await supabase
    .from("program_series_pillars")
    .upsert(
      { series_id: data.seriesId, pillar_key: data.pillarKey, title: data.title, published: data.published },
      { onConflict: "series_id,pillar_key" }
    )
    .select("id").single();
  if (error) return { pillarId: "", error: logAndGeneric("savePillar", error) };
  return { pillarId: row.id };
}

export async function savePillarBlocks(pillarId: string, blocks: SaveBlockInput[]): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  const supabase = auth.supabase;
  for (const b of blocks) {
    const v = validateBlock(b);
    if (!v.ok) return { error: v.error };
  }
  const rows = blocks.map((b, i) => ({
    block_type: b.block_type,
    sort_order: i,
    // content is Record<string,unknown> at the interface boundary; cast to Json for the DB insert.
    content: (
      b.block_type === "text" && typeof (b.content as { html?: unknown }).html === "string"
        ? { ...b.content, html: sanitizeRichText((b.content as { html: string }).html) }
        : b.content
    ) as Json,
  }));
  // Borrar e insertar en UNA llamada (021), ver saveBlocks (D2).
  // keep: rpc tipado en el CLIENTE, no en el método (regla 10).
  const client = supabase as unknown as {
    rpc: (fn: string, args: { p_pillar_id: string; p_blocks: typeof rows }) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await client.rpc("save_pillar_blocks", { p_pillar_id: pillarId, p_blocks: rows });
  if (error) return { error: logAndGeneric("savePillarBlocks", error) };
  revalidatePath("/portal/pilares");
  return {};
}
