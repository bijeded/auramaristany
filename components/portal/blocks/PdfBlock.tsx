import { FileText, ExternalLink } from "lucide-react";

interface PdfBlockContent {
  storage_path: string;
  filename: string;
  label: string;
}

function getPdfUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${storagePath}`;
}

export function PdfBlock({ content }: { content: PdfBlockContent }) {
  const url = getPdfUrl(content.storage_path);

  return (
    <div
      className="flex items-center justify-between rounded-xl mb-6 px-4 py-3"
      style={{ background: "var(--gris-claro)", border: "1px solid var(--gris-linea)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            width: 42,
            height: 42,
            background: "rgba(224,92,92,0.12)",
          }}
        >
          <FileText size={22} color="#e05c5c" />
        </div>
        <div>
          <p
            className="font-body"
            style={{ fontWeight: 600, fontSize: 14, color: "var(--negro)" }}
          >
            {content.filename}
          </p>
          {content.label && (
            <p className="font-body" style={{ fontSize: 12, color: "var(--gris-texto)" }}>
              {content.label}
            </p>
          )}
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 font-body"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--lavanda-dark)",
          textDecoration: "none",
          flexShrink: 0,
          marginLeft: 12,
        }}
      >
        Abrir <ExternalLink size={13} />
      </a>
    </div>
  );
}
