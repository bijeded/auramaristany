import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canDeleteClient, type SubStatus } from "@/lib/admin/clients-helpers";

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const admin = createServiceClient();

  // Guard: bloquear si hay suscripción no cancelada.
  // Se usa el service client (no RLS) para que el guard SIEMPRE vea todas las
  // suscripciones; un borrado irreversible no debe depender de que RLS las exponga.
  const { data: rawSubs } = await admin
    .from("subscriptions")
    .select("status")
    .eq("profile_id", params.clientId);
  const subs = ((rawSubs ?? []) as unknown as { status: SubStatus }[]);
  const guard = canDeleteClient(subs);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 409 });
  }

  // Borrar objetos de Storage de las fotos (no cascadean con la FK de BD).
  const { data: rawPhotos } = await admin
    .from("progress_photos")
    .select("storage_path")
    .eq("profile_id", params.clientId);
  const paths = ((rawPhotos ?? []) as unknown as { storage_path: string }[]).map((p) => p.storage_path);
  if (paths.length > 0) {
    await admin.storage.from("progress").remove(paths);
  }

  // Borrar el auth.user -> cascadea profiles y el resto (migración 007).
  const { error } = await admin.auth.admin.deleteUser(params.clientId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
