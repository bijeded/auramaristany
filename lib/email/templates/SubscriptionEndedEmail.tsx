import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function SubscriptionEndedEmail({ name, portalUrl }: { name: string; portalUrl: string }) {
  return (
    <Layout heading="Tu suscripción terminó" cta={{ href: portalUrl, label: "Reactivar" }}>
      <Text>Hola {name}, tu suscripción a Aura ha finalizado.</Text>
      <Text>Cuando quieras retomar tu camino, aquí estaremos. 💜</Text>
    </Layout>
  );
}
