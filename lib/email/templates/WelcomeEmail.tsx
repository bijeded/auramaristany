import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function WelcomeEmail({ name, portalUrl }: { name: string; portalUrl: string }) {
  return (
    <Layout heading={`¡Bienvenida, ${name}!`} cta={{ href: portalUrl, label: "Entrar a mi portal" }}>
      <Text>Tu suscripción está activa. Ya puedes empezar tu primer día de programa.</Text>
      <Text>Cualquier duda, Aura está contigo en el camino. 💜</Text>
    </Layout>
  );
}
