import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  type ActiveSubRow,
  formatDestination,
  formatReadCount,
} from "./message-helpers";

export interface AdminProgram {
  id: string;
  slug: string;
  name: string;
  billing_model: string;
  duration_months: number | null;
  is_active: boolean;
  series_count: number;
}

export interface AdminDay {
  id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  day_type: string;
  published: boolean;
}

export interface AdminSeries {
  id: string;
  series_number: number;
  title: string;
  description: string | null;
  published: boolean;
  days: AdminDay[];
}

export async function getAdminPrograms(): Promise<AdminProgram[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("programs")
    .select("id, slug, name, billing_model, duration_months, is_active")
    .order("name");

  if (!data) return [];

  // Count series per program
  const { data: counts } = await supabase
    .from("program_series")
    .select("program_id");

  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    const r = row as unknown as { program_id: string };
    countMap[r.program_id] = (countMap[r.program_id] ?? 0) + 1;
  }

  return (data as unknown as Omit<AdminProgram, "series_count">[]).map((p) => ({
    ...p,
    series_count: countMap[p.id] ?? 0,
  }));
}

export async function getAdminProgram(programId: string) {
  const supabase = await createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, slug, name, billing_model, duration_months, is_active")
    .eq("id", programId)
    .single();

  if (!program) return null;

  const { data: rawSeries } = await supabase
    .from("program_series")
    .select(
      "id, series_number, title, description, published, program_days(id, week_number, day_of_week, workout_focus, title, day_type, published)"
    )
    .eq("program_id", programId)
    .order("series_number");

  type RawSeries = Omit<AdminSeries, "days"> & {
    program_days: AdminDay[];
  };

  const series: AdminSeries[] = ((rawSeries ?? []) as unknown as RawSeries[]).map((s) => ({
    id: s.id,
    series_number: s.series_number,
    title: s.title,
    description: s.description,
    published: s.published,
    days: s.program_days ?? [],
  }));

  return { program: program as unknown as Omit<AdminProgram, "series_count">, series };
}

export interface BlockData {
  id: string;
  block_type: "text" | "youtube" | "pdf" | "image" | "exercise_list" | "cardio_zone2";
  sort_order: number;
  content: Record<string, unknown>;
}

export interface DayWithBlocks {
  id: string;
  series_id: string;
  week_number: number;
  day_of_week: string;
  workout_focus: string | null;
  title: string;
  description: string | null;
  day_type: string;
  duration_minutes: number | null;
  published: boolean;
  blocks: BlockData[];
}

export async function getDayWithBlocks(dayId: string): Promise<DayWithBlocks | null> {
  const supabase = await createClient();

  const { data: rawDay } = await supabase
    .from("program_days")
    .select(
      "id, series_id, week_number, day_of_week, workout_focus, title, description, day_type, duration_minutes, published"
    )
    .eq("id", dayId)
    .single();

  const day = rawDay as unknown as Omit<DayWithBlocks, "blocks"> | null;
  if (!day) return null;

  const { data: rawBlocks } = await supabase
    .from("program_day_blocks")
    .select("id, block_type, sort_order, content")
    .eq("day_id", dayId)
    .order("sort_order");

  return { ...day, blocks: (rawBlocks as unknown as BlockData[]) ?? [] };
}

export const PILLARS = [
  { key: "alimentacion", name: "Alimentación con intención" },
  { key: "autoconocimiento", name: "Autoconocimiento" },
  { key: "estres_sueno", name: "Manejo de estrés, descanso y sueño" },
  { key: "respiraciones", name: "Respiraciones y suelo pélvico" },
] as const;

export interface PillarRow {
  pillar_key: string;
  name: string;
  id: string | null;
  title: string | null;
  published: boolean;
}

export async function getSeriesPillars(seriesId: string): Promise<PillarRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_series_pillars")
    .select("id, pillar_key, title, published")
    .eq("series_id", seriesId);
  const existing = (data as unknown as { id: string; pillar_key: string; title: string; published: boolean }[]) ?? [];
  return PILLARS.map((p) => {
    const row = existing.find((e) => e.pillar_key === p.key);
    return { pillar_key: p.key, name: p.name, id: row?.id ?? null, title: row?.title ?? null, published: row?.published ?? false };
  });
}

export async function getPillarWithBlocks(seriesId: string, pillarKey: string): Promise<{
  id: string | null; pillar_key: string; title: string; published: boolean; blocks: BlockData[];
}> {
  const supabase = await createClient();
  const { data: rawPillar } = await supabase
    .from("program_series_pillars")
    .select("id, pillar_key, title, published")
    .eq("series_id", seriesId).eq("pillar_key", pillarKey).maybeSingle();

  const pillar = rawPillar as unknown as { id: string; pillar_key: string; title: string; published: boolean } | null;
  const name = PILLARS.find((p) => p.key === pillarKey)?.name ?? pillarKey;
  if (!pillar) return { id: null, pillar_key: pillarKey, title: name, published: false, blocks: [] };

  const { data: rawBlocks } = await supabase
    .from("program_pillar_blocks")
    .select("id, block_type, sort_order, content")
    .eq("pillar_id", pillar.id).order("sort_order");

  return { ...pillar, blocks: (rawBlocks as unknown as BlockData[]) ?? [] };
}

export interface SentMessage {
  id: string;
  subject: string;
  isBroadcast: boolean;
  createdAt: string;
  total: number;
  readCount: number;
  destination: string;
  readLabel: string;
}

export async function getActiveSubscriberRows(): Promise<ActiveSubRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "profile_id, program_variant_id, profiles(full_name, email, phone), program_variants(name, program_id, programs(name))"
    )
    .eq("status", "active");

  type Raw = {
    profile_id: string;
    program_variant_id: string;
    profiles: { full_name: string | null; email: string; phone: string | null } | null;
    program_variants: { name: string; program_id: string; programs: { name: string } | null } | null;
  };

  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.profiles && r.program_variants)
    .map((r) => ({
      profile_id: r.profile_id,
      full_name: r.profiles!.full_name,
      email: r.profiles!.email,
      phone: r.profiles!.phone,
      program_variant_id: r.program_variant_id,
      variant_name: r.program_variants!.name,
      program_id: r.program_variants!.program_id,
      program_name: r.program_variants!.programs?.name ?? "",
    }));
}

export async function getSentMessages(): Promise<SentMessage[]> {
  const supabase = await createClient();
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, subject, is_broadcast, created_at")
    .order("created_at", { ascending: false });

  const { data: recips } = await supabase
    .from("message_recipients")
    .select("message_id, read_at, recipient_id, profiles(full_name)");

  type RecRow = { message_id: string; read_at: string | null; profiles: { full_name: string | null } | null };
  const byMessage = new Map<string, { total: number; read: number; singleName: string | null }>();
  for (const r of ((recips ?? []) as unknown as RecRow[])) {
    let e = byMessage.get(r.message_id);
    if (!e) {
      e = { total: 0, read: 0, singleName: null };
      byMessage.set(r.message_id, e);
    }
    e.total += 1;
    if (r.read_at) e.read += 1;
    e.singleName = r.profiles?.full_name ?? e.singleName;
  }

  type MsgRow = { id: string; subject: string; is_broadcast: boolean; created_at: string };
  return ((msgs ?? []) as unknown as MsgRow[]).map((m) => {
    const agg = byMessage.get(m.id) ?? { total: 0, read: 0, singleName: null };
    return {
      id: m.id,
      subject: m.subject,
      isBroadcast: m.is_broadcast,
      createdAt: m.created_at,
      total: agg.total,
      readCount: agg.read,
      destination: formatDestination(m.is_broadcast, agg.total, agg.singleName),
      readLabel: formatReadCount(agg.read, agg.total),
    };
  });
}
