import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateAvatarUpload, avatarExtFor } from "@/lib/portal/avatar-validation";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }

  const check = validateAvatarUpload({ size: file.size, type: file.type });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const ext = avatarExtFor(file.type);
  const path = `${user.id}/avatar.${ext}`;

  const admin = createServiceClient();
  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (uploadError) {
    console.error("[avatar upload]", uploadError);
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  // Cache-bust: la ruta es fija (upsert), así el navegador no sirve la versión vieja.
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (admin as any)
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (dbError) {
    console.error("[avatar db]", dbError);
    return NextResponse.json({ error: "No se pudo guardar la imagen." }, { status: 500 });
  }

  return NextResponse.json({ url });
}
