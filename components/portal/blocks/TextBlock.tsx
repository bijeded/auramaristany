interface TextBlockContent {
  html: string;
}

export function TextBlock({ content }: { content: TextBlockContent }) {
  return (
    <div
      className="prose max-w-none mb-6 portal-richtext"
      style={{ fontFamily: "var(--font-body)", color: "var(--negro)" }}
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
}
// Nota A8: .portal-richtext mark { background: transparent } (globals.css) evita el
// amarillo por defecto del UA si un <mark> llega sin background-color inline.
