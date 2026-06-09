interface TextBlockContent {
  html: string;
}

export function TextBlock({ content }: { content: TextBlockContent }) {
  return (
    <div
      className="prose max-w-none mb-6"
      style={{ fontFamily: "var(--font-body)", color: "var(--negro)" }}
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
}
