"use client";

import { useMemo, useState } from "react";
import { classifyMedia, firstPhoto, type MediaItem } from "@/lib/video";

type Slide =
  | { type: "photo"; src: string }
  | { type: "video"; src: string; media: MediaItem };

export function ProductGallery({
  media,
  name,
}: {
  media: string[];
  name: string;
}) {
  const slides: Slide[] = useMemo(() => {
    const list = media.length ? media : ["/logo.png"];
    return list.map((src) => {
      const item = classifyMedia(src);
      if (item && (item.kind === "youtube" || item.kind === "vimeo" || item.kind === "file")) {
        return { type: "video" as const, src, media: item };
      }
      return { type: "photo" as const, src };
    });
  }, [media]);

  const [current, setCurrent] = useState(0);
  const slide = slides[current] || slides[0];

  return (
    <div className="gallery">
      {slide?.type === "photo" ? (
        <img src={slide.src} alt={name} />
      ) : slide?.type === "video" && slide.media.kind === "file" ? (
        <video src={slide.media.embedUrl} controls playsInline poster={firstPhoto({ media }) || undefined}>
          Demo video
        </video>
      ) : slide?.type === "video" && (slide.media.kind === "youtube" || slide.media.kind === "vimeo") ? (
        <div className="video-frame">
          <iframe
            src={slide.media.embedUrl}
            title={`${name} demo video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : slide?.type === "video" ? (
        <p className="note">
          <a href={slide.src} rel="noreferrer">
            Open demo video
          </a>
        </p>
      ) : null}

      {slides.length > 1 ? (
        <div className="thumbs">
          {slides.map((item, i) => (
            <button
              type="button"
              key={(item.type === "photo" ? item.src : item.src) + i}
              onClick={() => setCurrent(i)}
              aria-label={item.type === "video" ? `Video ${i + 1}` : `Photo ${i + 1}`}
            >
              {item.type === "photo" ? (
                <img src={item.src} alt="" />
              ) : (
                <span className="thumb-video">▶</span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
