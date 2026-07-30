import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function NewMessageEmail({
  subject,
  body,
  portalUrl,
}: {
  subject: string;
  body: string;
  portalUrl: string;
}) {
  return (
    <Layout heading="Tienes un nuevo mensaje de Aura" cta={{ href: portalUrl, label: "Ver mensaje" }}>
      <Text style={{ fontWeight: 600, color: "#1a1a1a", overflowWrap: "break-word", wordWrap: "break-word" }}>{subject}</Text>
      {/*
        El cuerpo es TEXTO PLANO (messages.body nunca ha sido HTML) y se
        interpola como hijo de <Text>, así que React lo escapa. Nunca usar
        dangerouslySetInnerHTML aquí: el cuerpo lo edita el admin y en A4 lo
        genera una plantilla.
        `pre-line` reproduce el mismo salto de línea que el portal
        (app/portal/messages/[id]/page.tsx); sin él los párrafos se colapsan.
      */}
      {/* `wordWrap` es el alias antiguo: motores tipo Outlook/Windows Mail no
          honran `overflow-wrap`. Cuesta nada y amplía la cobertura de clientes. */}
      <Text style={{ whiteSpace: "pre-line", overflowWrap: "break-word", wordWrap: "break-word" }}>{body}</Text>
    </Layout>
  );
}
