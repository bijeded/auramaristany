import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validatePhotoUpload } from "@/lib/portal/photo-validation";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const caption = (form.get("caption") as string | null) ?? null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }

  // Conteo actual de fotos de la clienta (para el tope).
  const { count } = await supabase
    .from("progress_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  const check = validatePhotoUpload({
    size: file.size,
    type: file.type,
    existingCount: count ?? 0,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const today = new Date().toISOString().split("T")[0];

  const admin = createServiceClient();
  const { error: uploadError } = await admin.storage
    .from("progress")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;
  const { data, error: insertError } = await client
    .from("progress_photos")
    .insert({
      profile_id: user.id,
      storage_path: path,
      taken_at: today,
      caption,
    })
    .select("id")
    .single();

  if (insertError) {
    await admin.storage.from("progress").remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
