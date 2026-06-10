import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string; photoId: string } }
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
  const { data: rawPhoto } = await admin
    .from("progress_photos")
    .select("storage_path")
    .eq("id", params.photoId)
    .eq("profile_id", params.clientId)
    .maybeSingle();
  const photo = rawPhoto as unknown as { storage_path: string } | null;
  if (!photo) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await admin.storage.from("progress").remove([photo.storage_path]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("progress_photos").delete().eq("id", params.photoId);

  return NextResponse.json({ ok: true });
}
