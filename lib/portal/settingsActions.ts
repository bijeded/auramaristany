"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePhone } from "@/lib/auth/phone";
import { createClient as createStatelessClient } from "@supabase/supabase-js";

export type ActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "No se pudo guardar. Intenta más tarde.";

export async function updateAccount(input: { fullName: string; phone: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: GENERIC_ERROR };

  const fullName = input.fullName.trim();
  if (fullName.length === 0) return { ok: false, error: "Ingresa tu nombre." };
  if (fullName.length > 120) return { ok: false, error: "El nombre es demasiado largo." };

  const phoneCheck = validatePhone(input.phone);
  if (!phoneCheck.ok) return { ok: false, error: phoneCheck.error! };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phoneCheck.normalized })
    .eq("id", user.id);

  if (error) {
    console.error("[updateAccount]", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/portal/settings");
  revalidatePath("/portal", "layout");
  return { ok: true };
}

export async function updatePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, error: GENERIC_ERROR };

  if (input.newPassword.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (input.newPassword !== input.confirmPassword) return { ok: false, error: "Las contraseñas no coinciden." };
  if (input.newPassword === input.currentPassword) return { ok: false, error: "La nueva contraseña debe ser distinta a la actual." };

  // Verifica la contraseña actual con un cliente SIN cookies (no toca la sesión activa).
  const stateless = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error: signInError } = await stateless.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (signInError) return { ok: false, error: "La contraseña actual es incorrecta." };

  const { error: updateError } = await supabase.auth.updateUser({ password: input.newPassword });
  if (updateError) {
    console.error("[updatePassword]", updateError);
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: true };
}
