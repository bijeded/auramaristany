import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Section, Text } from "@react-email/components";

const ROSA = "#eddbd8";
const LAVANDA = "#9982f4";
const NEGRO = "#1a1a1a";

export function Layout({ heading, children, cta }: {
  heading: string;
  children: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <Html lang="es">
      <Head />
      <Body style={{ backgroundColor: ROSA, fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 16, maxWidth: 480, margin: "0 auto", padding: 32 }}>
          <Text style={{ color: LAVANDA, fontWeight: 700, letterSpacing: 2, fontSize: 14, margin: 0 }}>AURA MARISTANY</Text>
          <Heading style={{ color: NEGRO, fontSize: 22, marginTop: 16 }}>{heading}</Heading>
          <Section style={{ color: "#444", fontSize: 15, lineHeight: "22px" }}>{children}</Section>
          {cta && (
            <Section style={{ marginTop: 24 }}>
              <Link href={cta.href}
                style={{ backgroundColor: LAVANDA, color: "#fff", borderRadius: 10, padding: "12px 20px", textDecoration: "none", fontWeight: 600, display: "inline-block" }}>
                {cta.label}
              </Link>
            </Section>
          )}
          <Text style={{ color: "#999", fontSize: 12, marginTop: 28 }}>Aura Maristany · Salud integral para mujeres 40+</Text>
        </Container>
      </Body>
    </Html>
  );
}
