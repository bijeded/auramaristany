import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function NewMessageEmail({ subject, portalUrl }: { subject: string; portalUrl: string }) {
  return (
    <Layout heading="Tienes un nuevo mensaje de Aura" cta={{ href: portalUrl, label: "Ver mensaje" }}>
      <Text>Aura te envió un mensaje:</Text>
      <Text style={{ fontWeight: 600, color: "#1a1a1a" }}>{subject}</Text>
      <Text>Ábrelo en tu portal para leerlo completo.</Text>
    </Layout>
  );
}
