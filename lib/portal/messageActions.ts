"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markMessageRead(messageId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Idempotente: solo escribe si está sin leer. La policy de UPDATE de la dueña (006) lo permite.
  const { error } = await supabase
    .from("message_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  // Refresca el layout del portal para que el badge de no-leídos se recalcule.
  if (!error) revalidatePath("/portal", "layout");
}
