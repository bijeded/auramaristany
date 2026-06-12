import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AdminDecision = { ok: true } | { ok: false; error: string };

// Decisión pura (testeable) separada del wiring de Supabase.
export function decideAdminAccess(
  user: { id: string } | null,
  role: string | null | undefined
): AdminDecision {
  if (!user) return { ok: false, error: "No autenticado" };
  if (role !== "admin") return { ok: false, error: "No autorizado" };
  return { ok: true };
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type AdminAuth =
  | { ok: true; supabase: SupabaseServer; user: { id: string } }
  | { ok: false; error: string };

// Verifica sesión + rol admin. Para server-actions: devuelve {ok,error}.
export async function requireAdmin(): Promise<AdminAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: prof } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const decision = decideAdminAccess(user, (prof as { role?: string } | null)?.role);
  if (!decision.ok) return decision;
  return { ok: true, supabase, user: user! };
}

// Para Server Components de páginas admin: redirige si no es admin.
export async function requireAdminPage(): Promise<void> {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/portal/today");
}
