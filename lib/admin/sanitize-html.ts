import sanitizeHtml from "sanitize-html";
import { decodePlainText } from "./plain-text";

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

// Texto plano: sin ningún tag ni atributo. Para campos cortos de texto libre
// (p. ej. el `detail` de la encuesta de cancelación, A9). Devuelve el texto sin
// HTML, ya recortado.
export function sanitizePlainText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
}

// Texto plano que se GUARDA y se vuelve a mostrar como texto plano (A4: los
// cuerpos de los mensajes automáticos). `sanitizePlainText` escapa `&`, `<`,
// `>`, `"` y `'` a entidades; como el portal y el email pintan el cuerpo con
// React (que ya escapa), un `&amp;` almacenado se vería literal en pantalla.
// Aquí se deshace ese escape una sola vez, delegando en `decodePlainText`: esa
// mitad la necesitan también los LECTORES de estas columnas (la ficha de
// cliente pinta el `detail` de la encuesta), y escondida aquí dentro no la veía
// ninguno.
//
// ⚠ INVARIANTE: al decodificar, el valor guardado puede volver a tener forma de
// HTML (un `<script>` escrito a mano queda como texto literal `<script>`). Una
// columna saneada con esta función NUNCA debe llegar a `dangerouslySetInnerHTML`
// ni al cuerpo HTML crudo de un email — sólo a sinks que escapan: texto en React
// (`white-space: pre-line`) y `<Text>{body}</Text>` de React Email.
export function sanitizePlainTextBody(input: string): string {
  return decodePlainText(sanitizePlainText(input));
}

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
