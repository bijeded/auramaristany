"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <Button
      className="w-full"
      style={{ background: "var(--lavanda)", color: "#fff" }}
      onClick={handleLogout}
    >
      Cerrar sesión
    </Button>
  );
}
