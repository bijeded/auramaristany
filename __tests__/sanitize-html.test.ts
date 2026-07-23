import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "@/lib/admin/sanitize-html";

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
