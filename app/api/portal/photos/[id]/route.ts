import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Valida pertenencia y obtiene el path.
  const { data: rawPhoto } = await supabase
    .from("progress_photos")
    .select("id, storage_path, profile_id")
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .maybeSingle();

  const photo = rawPhoto as unknown as { storage_path: string } | null;
  if (!photo) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const admin = createServiceClient();
  await admin.storage.from("progress").remove([photo.storage_path]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("progress_photos").delete().eq("id", params.id);

  return NextResponse.json({ ok: true });
}
