"use client";

import { useMemo, useState } from "react";
import { classifyMedia, type MediaItem } from "@/lib/video";

type Slide =
  | { type: "photo"; src: string }
  | { type: "video"; src: string; media: MediaItem };

export function ProductGallery({
  photos,
  videos,
  name,
}: {
  photos: string[];
  videos: string[];
  name: string;
}) {
  const slides: Slide[] = useMemo(() => {
    const videoSlides: Slide[] = videos
      .map((src) => {
        const media = classifyMedia(src);
        return media ? ({ type: "video", src, media } as Slide) : null;
      })
      .filter((s): s is Slide => Boolean(s));
    const photoSlides: Slide[] = (photos.length ? photos : videoSlides.length ? [] : ["/logo.png"]).map(
      (src) => ({ type: "photo", src }),
    );
    return [...photoSlides, ...videoSlides];
  }, [photos, videos]);

  const [current, setCurrent] = useState(0);
  const slide = slides[current] || slides[0];

  return (
    <div className="gallery">
      {slide?.type === "photo" ? (
        <img src={slide.src} alt={name} />
      ) : slide?.type === "video" && slide.media.kind === "file" ? (
        <video src={slide.media.embedUrl} controls playsInline poster={photos[0]}>
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
