"use client";

import { useState } from "react";

export function ProductGallery({ photos, name }: { photos: string[]; name: string }) {
  const list = photos.length ? photos : ["/logo.png"];
  const [current, setCurrent] = useState(0);
  const src = list[current] || list[0];

  return (
    <div className="gallery">
      <img src={src} alt={name} />
      {list.length > 1 ? (
        <div className="thumbs">
          {list.map((photo, i) => (
            <button type="button" key={photo + i} onClick={() => setCurrent(i)} aria-label={`Photo ${i + 1}`}>
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
