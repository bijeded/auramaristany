import sanitizeHtml from "sanitize-html";

// Solo hex #rrggbb — anclado: imposible colar url(), expression(), var(), etc. (A8)
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

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
      span: { color: [HEX_COLOR] },
      mark: { "background-color": [HEX_COLOR], color: [HEX_COLOR] },
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
