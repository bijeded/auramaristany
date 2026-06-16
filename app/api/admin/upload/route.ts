// app/api/admin/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAndGeneric } from "@/lib/admin/errors";

export async function POST(req: Request) {
  // Verifica que quien sube sea admin (RLS-aware client con la sesión del usuario)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const bucketPrefix = form.get("bucket"); // "pdfs" | "images"
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  }
  const prefix = bucketPrefix === "images" ? "images" : "pdfs";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${prefix}/${Date.now()}-${safeName}`;

  const admin = createServiceClient();
  const { error } = await admin.storage.from("content").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: logAndGeneric("upload", error) }, { status: 500 });

  return NextResponse.json({ storage_path: path, filename: file.name });
}
