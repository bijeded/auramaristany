// @vitest-environment jsdom
import { describe, it, expect, afterEach, afterAll } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { sanitizeRichText } from "@/lib/admin/sanitize-html";

// A8 regresión — pipeline real: el navegador normaliza hex → rgb() al serializar,
// y el sanitizer debe dejar pasar esa forma (bug: portal sin colores).
//
// Cada editor se destruye al terminar su prueba: uno vivo deja un timer de
// DOMObserver de ProseMirror que puede dispararse después de que jsdom se
// desmonta ("document is not defined") y tumbar CI con todas las pruebas en verde.
const editors: Editor[] = [];

function makeEditor(content = "<p>hola mundo</p>") {
  const ed = new Editor({
    extensions: [StarterKit, TextStyle, Color, Highlight.configure({ multicolor: true })],
    content,
  });
  editors.push(ed);
  return ed;
}

afterEach(() => {
  for (const ed of editors) if (!ed.isDestroyed) ed.destroy();
});

afterAll(() => {
  // Guarda de la fuga: ningún editor sobrevive a la suite.
  expect(editors.filter((ed) => !ed.isDestroyed)).toHaveLength(0);
});

describe("A8 pipeline Tiptap → sanitizer", () => {
  it("color de texto sobrevive el pipeline completo (forma rgb normalizada)", () => {
    const ed = makeEditor();
    ed.commands.selectAll();
    ed.commands.setColor("#7a63d4");
    const out = sanitizeRichText(ed.getHTML());
    expect(out).toMatch(/color:\s*rgb\(122,\s*99,\s*212\)/);
  });

  it("color + background combinados sobreviven juntos (blanco sobre negro)", () => {
    const ed = makeEditor();
    ed.commands.selectAll();
    ed.commands.setColor("#ffffff");
    ed.commands.selectAll();
    ed.commands.setHighlight({ color: "#1a1a1a" });
    const out = sanitizeRichText(ed.getHTML());
    expect(out).toMatch(/color:\s*rgb\(255,\s*255,\s*255\)/);
    expect(out).toMatch(/background-color:\s*rgb\(26,\s*26,\s*26\)/);
    expect(out).toContain('data-color="#1a1a1a"');
  });

  it("round-trip: el HTML saneado recarga en el editor con los colores", () => {
    const ed = makeEditor();
    ed.commands.selectAll();
    ed.commands.setColor("#7a63d4");
    const saved = sanitizeRichText(ed.getHTML());
    const ed2 = makeEditor(saved);
    expect(sanitizeRichText(ed2.getHTML())).toMatch(/rgb\(122,\s*99,\s*212\)/);
  });

  it("rgb hostil no pasa (fuera de forma anclada)", () => {
    expect(sanitizeRichText('<p><span style="color:rgb(1,1,1) url(x)">x</span></p>')).not.toContain("url");
    expect(sanitizeRichText('<p><span style="color:rgba(1,1,1,0.5)">x</span></p>')).not.toContain("rgba");
  });
});
