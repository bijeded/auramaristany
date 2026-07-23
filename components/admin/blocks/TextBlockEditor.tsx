"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Underline as UnderlineIcon, Type, Highlighter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

// A8 — paleta validada por contraste (ver openspec archive a8-editor-color-background)
const TEXT_COLORS: { hex: string; label: string }[] = [
  { hex: "#6b6b6b", label: "Gris" },
  { hex: "#7a63d4", label: "Lavanda oscuro" },
  { hex: "#9982f4", label: "Lavanda" },
  { hex: "#e05c5c", label: "Coral" },
  { hex: "#3a9468", label: "Verde" },
];
const BG_COLORS: { hex: string; label: string }[] = [
  { hex: "#eddbd8", label: "Rosa" },
  { hex: "#f6ecea", label: "Rosa suave" },
  { hex: "#efeafe", label: "Lavanda suave" },
  { hex: "#b4b3a4", label: "Salvia" },
  { hex: "#f5f5f5", label: "Gris claro" },
];
const HEX_RE = /^#[0-9a-f]{6}$/i;

function ColorDropdown({
  editor,
  kind,
}: {
  editor: Editor;
  kind: "text" | "bg";
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Cierre al hacer click fuera (patrón DayCellMenu) + Escape con retorno de foco
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const swatches = kind === "text" ? TEXT_COLORS : BG_COLORS;
  const apply = (hex: string | null) => {
    const chain = editor.chain().focus();
    if (kind === "text") {
      (hex ? chain.setColor(hex) : chain.unsetColor()).run();
    } else {
      (hex ? chain.setHighlight({ color: hex }) : chain.unsetHighlight()).run();
    }
    setOpen(false);
    setCustom("");
  };
  const customValid = HEX_RE.test(custom);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={kind === "text" ? "Color de texto" : "Color de fondo"}
        aria-haspopup="true"
        aria-expanded={open}
        className="p-1.5 rounded text-[var(--gris-texto)]"
        onClick={() => setOpen((o) => !o)}
      >
        {kind === "text" ? <Type size={15} /> : <Highlighter size={15} />}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-20 rounded-lg p-2 bg-white"
          style={{ border: "1px solid var(--gris-linea)", boxShadow: "var(--shadow-pop)", width: 168 }}
        >
          <button
            type="button"
            className="font-body w-full text-left rounded px-2 py-1.5 mb-1"
            style={{ fontSize: 12, color: "var(--gris-texto)" }}
            onClick={() => apply(null)}
          >
            {kind === "text" ? "Automático" : "Sin fondo"}
          </button>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {swatches.map((s) => (
              <button
                key={s.hex}
                type="button"
                aria-label={s.label}
                title={s.label}
                onClick={() => apply(s.hex)}
                className="flex items-center justify-center"
                style={{ width: 36, height: 36 }}
              >
                <span
                  className="rounded-full"
                  style={{ width: 24, height: 24, background: s.hex, border: "1px solid var(--gris-linea)", display: "block" }}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (customValid) apply(custom);
                }
              }}
              placeholder="#a1b2c3"
              aria-label="Color personalizado (hex)"
              className="font-body w-full rounded px-2 py-1"
              style={{ fontSize: 12, border: "1px solid var(--gris-linea)" }}
            />
            <button
              type="button"
              disabled={!customValid}
              onClick={() => apply(custom)}
              className="font-body rounded px-2"
              style={{
                fontSize: 12,
                fontWeight: 600,
                background: customValid ? "var(--lavanda)" : "var(--gris-claro)",
                color: customValid ? "#fff" : "var(--gris-suave)",
              }}
            >
              OK
            </button>
          </div>
          <p className="font-body mt-1" style={{ fontSize: 10.5, color: "var(--gris-suave)" }}>
            Revisa que se lea bien
          </p>
        </div>
      )}
    </div>
  );
}

export function TextBlockEditor({
  content, onChange,
}: { content: { html?: string }; onChange: (c: { html: string }) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color, Highlight.configure({ multicolor: true })],
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
        <button type="button" aria-label="Subrayado" className={btn(editor.isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 4 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          style={{ fontFamily: "var(--font-head)", fontSize: 13, fontWeight: 700 }}>H4</button>
        <button type="button" className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></button>
        <button type="button" className={btn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></button>
        <ColorDropdown editor={editor} kind="text" />
        <ColorDropdown editor={editor} kind="bg" />
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 font-body" />
    </div>
  );
}
