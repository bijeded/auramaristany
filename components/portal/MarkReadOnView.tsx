"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markMessageRead } from "@/lib/portal/messageActions";

/**
 * Marca el mensaje como leído al montar el detalle y refresca el árbol del
 * portal para que el badge de no-leídos (en el layout persistente) se actualice
 * sin tener que recargar manualmente.
 */
export function MarkReadOnView({ messageId }: { messageId: string }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    markMessageRead(messageId).then(() => {
      if (active) router.refresh();
    });
    return () => {
      active = false;
    };
  }, [messageId, router]);
  return null;
}
