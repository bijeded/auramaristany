"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Heading2, List } from "lucide-react";

export function TextBlockEditor({
  content, onChange,
}: { content: { html?: string }; onChange: (c: { html: string }) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content.html ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange({ html: editor.getHTML() }),
  });
  if (!editor) return null;

  const btn = (active: boolean) =>
    `p-1.5 rounded ${active ? "bg-[var(--lavanda-tint)] text-[var(--lavanda-dark)]" : "text-[var(--gris-texto)]"}`;

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--gris-linea)" }}>
      <div className="flex gap-1 p-2 border-b" style={{ borderColor: "var(--gris-linea)" }}>
        <button type="button" className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></button>
        <button type="button" className={btn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></button>
        <button type="button" className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></button>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 font-body" />
    </div>
  );
}
