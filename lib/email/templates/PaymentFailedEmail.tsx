import * as React from "react";
import { Text } from "@react-email/components";
import { Layout } from "./Layout";

export function PaymentFailedEmail({ name, portalUrl }: { name: string; portalUrl: string }) {
  return (
    <Layout heading="No pudimos procesar tu pago" cta={{ href: portalUrl, label: "Actualizar mi tarjeta" }}>
      <Text>Hola {name}, tu último cobro no se pudo completar.</Text>
      <Text>Actualiza tu método de pago para no perder el acceso a tu programa.</Text>
    </Layout>
  );
}
