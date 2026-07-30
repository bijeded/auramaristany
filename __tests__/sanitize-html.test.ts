import { describe, it, expect } from "vitest";
import { sanitizeRichText, sanitizePlainTextBody, sanitizePlainText } from "@/lib/admin/sanitize-html";
import { decodePlainText } from "@/lib/admin/plain-text";

describe("sanitizeRichText", () => {
  it("elimina <script>", () => {
    expect(sanitizeRichText('<p>hola</p><script>alert(1)</script>')).toBe("<p>hola</p>");
  });
  it("elimina handlers on*", () => {
    expect(sanitizeRichText('<p onclick="evil()">hola</p>')).toBe("<p>hola</p>");
  });
  it("elimina javascript: en href", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
  it("preserva formato legítimo de Tiptap", () => {
    const html = "<h2>Título</h2><p><strong>negrita</strong> y <em>cursiva</em></p><ul><li>uno</li></ul>";
    expect(sanitizeRichText(html)).toBe(html);
  });
  it("preserva enlaces con href http", () => {
    expect(sanitizeRichText('<a href="https://x.com">x</a>')).toContain('href="https://x.com"');
  });
});

// ---------------------------------------------------------------------------
// A8 — color de texto y fondo (span/mark con style hex estricto) + subrayado
// ---------------------------------------------------------------------------

describe("sanitizeRichText — colores A8", () => {
  it("preserva color de texto hex en span", () => {
    const html = '<p><span style="color:#9982f4">lila</span></p>';
    expect(sanitizeRichText(html)).toContain("color:#9982f4");
  });

  it("preserva background-color hex en mark (con data-color)", () => {
    const html = '<p><mark data-color="#eddbd8" style="background-color:#eddbd8">rosa</mark></p>';
    const out = sanitizeRichText(html);
    expect(out).toContain("background-color:#eddbd8");
    expect(out).toContain('data-color="#eddbd8"');
  });

  it("preserva <u> subrayado", () => {
    expect(sanitizeRichText("<p><u>sub</u></p>")).toBe("<p><u>sub</u></p>");
  });

  it("elimina estilos hostiles y no-hex", () => {
    expect(sanitizeRichText('<p><span style="position:fixed;top:0">x</span></p>')).not.toContain("position");
    expect(sanitizeRichText('<p><span style="color:red">x</span></p>')).not.toContain("red");
    expect(sanitizeRichText('<p><span style="color:expression(alert(1))">x</span></p>')).not.toContain("expression");
    expect(sanitizeRichText('<p><mark style="background-color:url(https://evil.com)">x</mark></p>')).not.toContain("url(");
    expect(sanitizeRichText('<p><span style="color:var(--x)">x</span></p>')).not.toContain("var(");
  });

  it("elimina style en tags no autorizados", () => {
    expect(sanitizeRichText('<p style="color:#9982f4">x</p>')).toBe("<p>x</p>");
  });

  it("hex de 3 dígitos y 8 dígitos no pasan (solo #rrggbb)", () => {
    expect(sanitizeRichText('<p><span style="color:#fff">x</span></p>')).not.toContain("#fff");
    expect(sanitizeRichText('<p><span style="color:#11223344">x</span></p>')).not.toContain("#1122334");
  });
});

describe("sanitizeRichText — data-color restringido (hallazgo security-review)", () => {
  it("elimina data-color no-hex pero conserva el hex válido", () => {
    const bad = '<p><mark data-color="javascript:x" style="background-color:#eddbd8">x</mark></p>';
    const out = sanitizeRichText(bad);
    expect(out).not.toContain("javascript:");
    expect(out).toContain("background-color:#eddbd8");
    const good = '<p><mark data-color="#eddbd8" style="background-color:#eddbd8">x</mark></p>';
    expect(sanitizeRichText(good)).toContain('data-color="#eddbd8"');
  });
});

// ---------------------------------------------------------------------------
// A4 — cuerpo de texto plano (mensajes automáticos)
// ---------------------------------------------------------------------------

describe("sanitizePlainTextBody", () => {
  it("elimina cualquier tag", () => {
    expect(sanitizePlainTextBody("<script>alert(1)</script>Hola")).toBe("Hola");
    expect(sanitizePlainTextBody("<b>Hola</b> Aura")).toBe("Hola Aura");
  });

  it("NO deja entidades HTML escapadas en el texto guardado", () => {
    // El cuerpo se guarda y se muestra como texto plano (React lo escapa al
    // pintarlo), así que un "&amp;" almacenado se vería literal en el portal.
    expect(sanitizePlainTextBody("Fuerza & salud")).toBe("Fuerza & salud");
    expect(sanitizePlainTextBody("5 < 10 > 3")).toBe("5 < 10 > 3");
    expect(sanitizePlainTextBody(`Dice "hola" y 'adiós'`)).toBe(`Dice "hola" y 'adiós'`);
  });

  it("no decodifica dos veces", () => {
    expect(sanitizePlainTextBody("&amp;lt;")).toBe("&lt;");
  });

  it("preserva los saltos de línea y los párrafos en blanco", () => {
    expect(sanitizePlainTextBody("Hola {nombre},\n\nsegundo párrafo")).toBe(
      "Hola {nombre},\n\nsegundo párrafo"
    );
  });

  it("preserva el placeholder {nombre} intacto", () => {
    expect(sanitizePlainTextBody("Hola {nombre}")).toBe("Hola {nombre}");
  });

  it("recorta espacios en los extremos", () => {
    expect(sanitizePlainTextBody("  Hola  ")).toBe("Hola");
  });
});

// El decode extraído. Vive aparte de `sanitizePlainTextBody` porque lo importan
// módulos que acaban en el bundle del navegador (`clients-helpers` →
// `ClientDetailTabs`, marcado "use client"), y `sanitize-html.ts` arrastraría
// la librería entera con él.
describe("decodePlainText", () => {
  it("deshace el escape que `sanitizePlainText` dejó puesto", () => {
    const stored = sanitizePlainText('Ana & "Bea" <3');
    expect(decodePlainText(stored)).toBe('Ana & "Bea" <3');
  });

  it("`&amp;` va al final: no decodifica dos veces", () => {
    expect(decodePlainText("&amp;lt;")).toBe("&lt;");
  });

  // ⚠ Esto NO es un defecto: es la invariante, fijada para que se lea. Lo que
  // sale de aquí puede volver a tener forma de HTML, así que sólo puede llegar
  // a sinks que escapan —texto en React, `<Text>` de React Email— y nunca a
  // `dangerouslySetInnerHTML` ni al cuerpo HTML crudo de un correo. La prueba
  // existe para que quien la rompa tenga que borrarla a mano.
  it("INVARIANTE: el valor decodificado puede tener forma de HTML", () => {
    expect(decodePlainText("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(
      "<script>alert(1)</script>"
    );
  });
});
