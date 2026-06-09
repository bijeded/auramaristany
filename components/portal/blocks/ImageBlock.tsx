interface ImageBlockContent {
  storage_path: string;
  alt: string;
}

function getImageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content/${storagePath}`;
}

export function ImageBlock({ content }: { content: ImageBlockContent }) {
  const url = getImageUrl(content.storage_path);

  return (
    <div className="mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={content.alt}
        className="w-full rounded-xl object-cover"
        style={{ maxHeight: 360 }}
      />
      {content.alt && (
        <p
          className="mt-2 font-body text-center"
          style={{ fontSize: 12, color: "var(--gris-suave)" }}
        >
          {content.alt}
        </p>
      )}
    </div>
  );
}
