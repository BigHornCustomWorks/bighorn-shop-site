"use client";

import { isVideoSrc } from "@/lib/video";

export function SignSampleGrid({
  media,
  selected,
  onWant,
}: {
  media: string[];
  selected: string;
  onWant: (src: string) => void;
}) {
  const photos = media.filter((src) => src && !isVideoSrc(src));
  if (!photos.length) return null;

  return (
    <div className="sign-samples">
      {photos.map((src) => (
        <figure key={src} className={src === selected ? "sign-sample on" : "sign-sample"}>
          <img src={src} alt="Sample metal sign" />
          <button type="button" className="btn btn-spark" onClick={() => onWant(src)}>
            I want this
          </button>
        </figure>
      ))}
    </div>
  );
}
