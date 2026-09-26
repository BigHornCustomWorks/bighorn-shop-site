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
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

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
      <p className="note">
        First photo is the card image and the first shot on the product page. Use the arrows or drag to reorder. Save
        products when the order looks right.
      </p>
      <div className="mc-media-list">
        {urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className={hover === i && drag != null && drag !== i ? "mc-media-item drop" : "mc-media-item"}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setHover(i);
            }}
            onDragLeave={() => setHover(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = drag ?? Number(e.dataTransfer.getData("text/plain"));
              move(from, i);
              setDrag(null);
              setHover(null);
            }}
            onDragEnd={() => {
              setDrag(null);
              setHover(null);
            }}
          >
            {isVideoSrc(url) ? (
              <span className="thumb-video" title={url} draggable={false}>
                ▶
              </span>
            ) : (
              <img src={url} alt="" draggable={false} />
            )}
            <button
              type="button"
              className="mc-media-remove"
              title="Remove"
              onClick={() => onChange(urls.filter((_, n) => n !== i))}
            >
              ×
            </button>
            <span className="mc-media-order">{i === 0 ? "1 · main" : i + 1}</span>
            <div className="mc-media-move">
              <button type="button" title="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>
                ‹
              </button>
              <button
                type="button"
                title="Move later"
                disabled={i === urls.length - 1}
                onClick={() => move(i, i + 1)}
              >
                ›
              </button>
            </div>
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
        <input
          className="mc-drop-input"
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
