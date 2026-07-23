import sanitizeHtml from "sanitize-html";

// Formas seguras y ancladas (A8). El navegador normaliza hex → rgb(r, g, b) al
// serializar estilos inline (CSSStyleDeclaration), así que ambas deben pasar.
// Ancladas: imposible colar url(), expression(), var(), etc.
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_COLOR = [
  HEX_COLOR,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
];
// Highlight de Tiptap emite `color: inherit` dentro del mark
const SAFE_TEXT_COLOR = [...SAFE_COLOR, /^inherit$/];

// Whitelist conservadora para el output de Tiptap (starter-kit + enlaces + color A8).
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "code", "pre", "blockquote",
      "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a",
      "span", "mark",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
      mark: ["style", "data-color"],
    },
    allowedStyles: {
      span: { color: SAFE_COLOR },
      mark: { "background-color": SAFE_COLOR, color: SAFE_TEXT_COLOR },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      // data-color solo hex — misma política que style (hallazgo security-review A8)
      mark: (tagName, attribs) => {
        if (attribs["data-color"] && !HEX_COLOR.test(attribs["data-color"])) {
          const rest = { ...attribs };
          delete rest["data-color"];
          return { tagName, attribs: rest };
        }
        return { tagName, attribs };
      },
    },
  });
}
