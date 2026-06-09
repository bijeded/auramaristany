"use client";

import { useState } from "react";
import { Play } from "lucide-react";

interface YoutubeBlockContent {
  video_id: string;
  title: string;
}

export function YoutubeBlock({ content }: { content: YoutubeBlockContent }) {
  const [playing, setPlaying] = useState(false);
  const thumbnail = `https://img.youtube.com/vi/${content.video_id}/hqdefault.jpg`;

  return (
    <div className="mb-6">
      <div
        className="relative overflow-hidden rounded-xl"
        style={{ aspectRatio: "16/9", background: "#1a1a1a" }}
      >
        {playing ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${content.video_id}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={content.title}
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt={content.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <button
              onClick={() => setPlaying(true)}
              aria-label="Reproducir"
              className="absolute inset-0 flex items-center justify-center"
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 62,
                  height: 62,
                  background: "rgba(255,255,255,0.92)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                }}
              >
                <Play
                  size={26}
                  fill="var(--lavanda)"
                  color="var(--lavanda)"
                  style={{ marginLeft: 3 }}
                />
              </div>
            </button>
          </>
        )}
      </div>
      {content.title && (
        <p
          className="mt-2 font-body"
          style={{ fontSize: 13, color: "var(--gris-texto)" }}
        >
          {content.title}
        </p>
      )}
    </div>
  );
}
