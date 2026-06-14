"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AvatarUpload({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/portal/avatar", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo subir la imagen.");
      return;
    }
    const { url: newUrl } = await res.json();
    setUrl(newUrl);
    router.refresh();
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto" }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} width={96} height={96}
            style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--lavanda-tint)",
            color: "var(--lavanda-dark)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 600 }}>
            {initials(name)}
          </div>
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
          aria-label="Cambiar foto de perfil"
          style={{ position: "absolute", bottom: 0, right: 0, width: 32, height: 32, borderRadius: "50%",
            background: "var(--lavanda)", border: "3px solid var(--rosa-soft)", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Camera size={15} color="#fff" />
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
      </div>
      {loading && <p className="font-body text-xs" style={{ color: "var(--gris-suave)", marginTop: 8 }}>Subiendo...</p>}
      {error && <p className="font-body text-xs" style={{ color: "var(--error)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
