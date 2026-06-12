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
