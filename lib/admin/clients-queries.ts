import "server-only";
import { requireAdmin } from "./auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  pickPrimarySubscription,
  canDeleteClient,
  type ClientListRow,
  type SubStatus,
} from "./clients-helpers";
import { countCompleted } from "@/lib/content/history-helpers";
import type { ExercisesDone } from "@/lib/content/history-helpers";

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
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
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

export interface ClientSubscription {
  id: string;
  program_name: string;
  variant_name: string;
  billing_model: string;
  duration_months: number | null;
  months_elapsed: number;
  status: SubStatus;
  enrollment_date: string;
  current_period_end: string | null;
  price_mxn: number;
}

export interface OnboardingAnswer { question: string; answer: string }
export interface ProgressEntry { date: string; title: string; focus: string | null; completed: boolean; doneCount: number }
export interface ClientPhoto { id: string; url: string; photoDate: string; caption: string | null }
export interface PaymentEntry { date: string; amount: number; status: string }
export interface ClientMessage { id: string; subject: string; createdAt: string; readAt: string | null }

export interface ClientDetail {
  profile: { id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null };
  subscriptions: ClientSubscription[];
  onboarding: OnboardingAnswer[];
  progress: ProgressEntry[];
  photos: ClientPhoto[];
  payments: PaymentEntry[];
  messages: ClientMessage[];
  canDelete: { ok: boolean; reason?: string };
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  const supabase = await createClient();

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, avatar_url")
    .eq("id", clientId)
    .maybeSingle();
  const profile = rawProfile as unknown as ClientDetail["profile"] | null;
  if (!profile) return null;

  // Suscripciones
  const { data: rawSubs } = await supabase
    .from("subscriptions")
    .select(
      "id, status, enrollment_date, current_period_end, months_elapsed, program_variants(name, price_mxn, programs(name, billing_model, duration_months))"
    )
    .eq("profile_id", clientId)
    .order("enrollment_date", { ascending: false });

  type RawSub = {
    id: string; status: SubStatus; enrollment_date: string; current_period_end: string | null; months_elapsed: number;
    program_variants: { name: string; price_mxn: number; programs: { name: string; billing_model: string; duration_months: number | null } | null } | null;
  };
  const subscriptions: ClientSubscription[] = ((rawSubs ?? []) as unknown as RawSub[])
    .filter((s) => s.program_variants)
    .map((s) => ({
      id: s.id,
      program_name: s.program_variants!.programs?.name ?? "—",
      variant_name: s.program_variants!.name,
      billing_model: s.program_variants!.programs?.billing_model ?? "rolling_monthly",
      duration_months: s.program_variants!.programs?.duration_months ?? null,
      months_elapsed: s.months_elapsed,
      status: s.status,
      enrollment_date: s.enrollment_date,
      current_period_end: s.current_period_end,
      price_mxn: s.program_variants!.price_mxn,
    }));

  // Onboarding
  const { data: rawQuestions } = await supabase
    .from("onboarding_questions")
    .select("id, question_text, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  const { data: rawResp } = await supabase
    .from("onboarding_responses")
    .select("responses")
    .eq("profile_id", clientId)
    .maybeSingle();

  type Q = { id: string; question_text: string };
  const responses = ((rawResp as unknown as { responses: Record<string, unknown> } | null)?.responses) ?? {};
  const onboarding: OnboardingAnswer[] = ((rawQuestions ?? []) as unknown as Q[]).map((q) => {
    const v = responses[q.id];
    const answer = Array.isArray(v) ? v.join(" · ") : v == null || v === "" ? "—" : String(v);
    return { question: q.question_text, answer };
  });

  // Progreso
  const { data: rawLogs } = await supabase
    .from("progress_logs")
    .select("log_date, completed, exercises_done, program_days(title, workout_focus)")
    .eq("profile_id", clientId)
    .order("log_date", { ascending: false });
  type RawLog = { log_date: string; completed: boolean; exercises_done: ExercisesDone | null; program_days: { title: string; workout_focus: string | null } | null };
  const progress: ProgressEntry[] = ((rawLogs ?? []) as unknown as RawLog[]).map((l) => ({
    date: l.log_date,
    title: l.program_days?.title ?? "Día",
    focus: l.program_days?.workout_focus ?? null,
    completed: l.completed,
    doneCount: countCompleted(l.exercises_done),
  }));

  // Fotos (rows vía RLS admin; signed URLs vía service client)
  const { data: rawPhotos } = await supabase
    .from("progress_photos")
    .select("id, storage_path, taken_at, caption")
    .eq("profile_id", clientId)
    .order("taken_at", { ascending: false });
  type RawPhoto = { id: string; storage_path: string; taken_at: string; caption: string | null };
  const service = createServiceClient();
  const photos: ClientPhoto[] = [];
  for (const p of (rawPhotos ?? []) as unknown as RawPhoto[]) {
    const { data: signed } = await service.storage.from("progress").createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) {
      photos.push({ id: p.id, url: signed.signedUrl, photoDate: p.taken_at, caption: p.caption });
    }
  }

  // Pagos (invoices de las suscripciones del cliente)
  const { data: rawInvoices } = await supabase
    .from("invoices")
    .select("amount_paid, invoice_date, status, subscriptions!inner(profile_id)")
    .eq("subscriptions.profile_id", clientId)
    .order("invoice_date", { ascending: false });
  type RawInv = { amount_paid: number; invoice_date: string; status: string };
  const payments: PaymentEntry[] = ((rawInvoices ?? []) as unknown as RawInv[]).map((i) => ({
    date: i.invoice_date,
    amount: i.amount_paid,
    status: i.status,
  }));

  // Mensajes
  const { data: rawMsgs } = await supabase
    .from("message_recipients")
    .select("read_at, messages(id, subject, created_at)")
    .eq("recipient_id", clientId);
  type RawMsg = { read_at: string | null; messages: { id: string; subject: string; created_at: string } | null };
  const messages: ClientMessage[] = ((rawMsgs ?? []) as unknown as RawMsg[])
    .filter((m) => m.messages)
    .map((m) => ({ id: m.messages!.id, subject: m.messages!.subject, createdAt: m.messages!.created_at, readAt: m.read_at }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    profile,
    subscriptions,
    onboarding,
    progress,
    photos,
    payments,
    messages,
    canDelete: canDeleteClient(subscriptions),
  };
}
