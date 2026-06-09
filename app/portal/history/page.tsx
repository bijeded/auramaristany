import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHistoryList, getPerformanceData } from "@/lib/content/history";
import { ProgressView } from "@/components/portal/ProgressView";
import type { PhotoItem } from "@/components/portal/PhotosTab";

interface PhotoRow {
  id: string;
  storage_path: string;
  photo_date: string;
  caption: string | null;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [history, performance] = await Promise.all([
    getHistoryList(user.id),
    getPerformanceData(user.id),
  ]);

  // Fotos + signed URLs (bucket privado).
  const { data: rawPhotos } = await supabase
    .from("progress_photos")
    .select("id, storage_path, photo_date, caption")
    .eq("profile_id", user.id)
    .order("photo_date", { ascending: false });

  const photoRows = (rawPhotos ?? []) as unknown as PhotoRow[];
  const photos: PhotoItem[] = [];
  for (const p of photoRows) {
    const { data: signed } = await supabase.storage
      .from("progress")
      .createSignedUrl(p.storage_path, 3600);
    if (signed?.signedUrl) {
      photos.push({
        id: p.id,
        url: signed.signedUrl,
        photoDate: p.photo_date,
        caption: p.caption,
      });
    }
  }

  return <ProgressView performance={performance} history={history} photos={photos} />;
}
