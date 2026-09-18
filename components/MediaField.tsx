"use client";

import { useState } from "react";
import { fileUploadKind, isVideoSrc } from "@/lib/video";

export function MediaField({
  urls,
  onChange,
  onUpload,
  busyLabel,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  onUpload: (file: File) => Promise<string | void>;
  busyLabel?: string;
}) {
  const [paste, setPaste] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    setBusy(true);
    const added: string[] = [];
    try {
      for (const file of list) {
        const url = await onUpload(file);
        if (url) added.push(url);
      }
      if (added.length) onChange([...urls, ...added]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-media-field">
      <p className="note">Photos and videos in one list. Drag to set the order they show.</p>
      <div className="mc-media-list">
        {urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="mc-media-item"
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag == null || drag === i) return;
              const next = [...urls];
              const [item] = next.splice(drag, 1);
              next.splice(i, 0, item);
              onChange(next);
              setDrag(null);
            }}
          >
            {isVideoSrc(url) ? (
              <span className="thumb-video" title={url}>
                ▶
              </span>
            ) : (
              <img src={url} alt="" />
            )}
            <button
              type="button"
              className="mc-media-remove"
              title="Remove"
              onClick={() => onChange(urls.filter((_, n) => n !== i))}
            >
              ×
            </button>
            <span className="mc-media-order">{i + 1}</span>
          </div>
        ))}
      </div>

      <label
        className={over ? "mc-drop over" : "mc-drop"}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void send(e.dataTransfer.files);
        }}
      >
        <strong>{busy ? busyLabel || "Uploading…" : "Drop photos or videos here"}</strong>
        <span className="muted">or click to choose files — they upload as soon as you pick them</span>
        <input className="mc-drop-input"
          type="file"
          multiple
          accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
          disabled={busy}
          onChange={(e) => {
            void send(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <label>
        Or paste a photo, YouTube, Vimeo, or mp4 URL
        <input
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="https://… or /uploads/…"
        />
      </label>
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (!paste.trim()) return;
          onChange([...urls, paste.trim()]);
          setPaste("");
        }}
      >
        Add media URL
      </button>
    </div>
  );
}
