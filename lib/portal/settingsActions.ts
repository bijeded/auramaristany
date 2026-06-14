"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePhone } from "@/lib/auth/phone";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
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
