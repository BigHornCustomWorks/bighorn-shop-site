"use client";

import { newId } from "@/lib/sanitize";
import type { GalleryPhoto, GallerySection, ShopStore } from "@/lib/types";

type Props = {
  store: ShopStore;
  setStore: (s: ShopStore) => void;
  save: (s: ShopStore) => Promise<void> | void;
  uploadTo?: (id: string, file: File) => Promise<void>;
};

function emptySection(): GallerySection {
  return { id: newId("gal"), title: "New gallery section", subtitle: "", visible: true, sortOrder: 99, photos: [] };
}

function emptyPhoto(): GalleryPhoto {
  return { id: newId("photo"), src: "", caption: "", alt: "", simulated: false };
}

export function GalleryTab({ store, setStore, save }: Props) {
  const gallery = store.gallery || [];
  const update = (next: GallerySection[]) => {
    setStore({ ...store, gallery: next.map((s, i) => ({ ...s, sortOrder: i + 1 })) });
  };

  return (
    <div>
      <h2>Gallery</h2>
      <p className="note">Photo sections for /gallery. Not products. Samples use simulated flag.</p>
      <button className="btn" type="button" onClick={() => update([...gallery, emptySection()])}>Add section</button>
      {gallery.map((section, si) => (
        <div key={section.id} className="card" style={{ marginTop: 16, padding: 16 }}>
          <label>Title<input value={section.title} onChange={(e) => update(gallery.map((s, i) => i === si ? { ...s, title: e.target.value } : s))} /></label>
          <label>Subtitle<input value={section.subtitle} onChange={(e) => update(gallery.map((s, i) => i === si ? { ...s, subtitle: e.target.value } : s))} /></label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={section.visible} onChange={(e) => update(gallery.map((s, i) => i === si ? { ...s, visible: e.target.checked } : s))} />
            Visible on /gallery
          </label>
          <button className="btn" type="button" onClick={() => update(gallery.map((s, i) => i === si ? { ...s, photos: [...s.photos, emptyPhoto()] } : s))}>Add photo</button>
          <button className="btn" type="button" onClick={() => update(gallery.filter((_, i) => i !== si))}>Delete section</button>
          {section.photos.map((photo, pi) => (
            <div key={photo.id} className="card" style={{ padding: 12, marginTop: 10 }}>
              <label>Image URL<input value={photo.src} onChange={(e) => update(gallery.map((s, i) => i !== si ? s : { ...s, photos: s.photos.map((ph, j) => j === pi ? { ...ph, src: e.target.value } : ph) }))} /></label>
              <label>Caption<input value={photo.caption} onChange={(e) => update(gallery.map((s, i) => i !== si ? s : { ...s, photos: s.photos.map((ph, j) => j === pi ? { ...ph, caption: e.target.value, alt: e.target.value || ph.alt } : ph) }))} /></label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={photo.simulated === true} onChange={(e) => update(gallery.map((s, i) => i !== si ? s : { ...s, photos: s.photos.map((ph, j) => j === pi ? { ...ph, simulated: e.target.checked } : ph) }))} />
                Simulated / sample image
              </label>
              {photo.src ? <img src={photo.src} alt="" style={{ maxWidth: 160, marginTop: 8 }} /> : null}
              <button className="btn" type="button" onClick={() => update(gallery.map((s, i) => i === si ? { ...s, photos: s.photos.filter((_, j) => j !== pi) } : s))}>Remove photo</button>
            </div>
          ))}
        </div>
      ))}
      <button className="btn btn-bronze" type="button" style={{ marginTop: 16 }} onClick={() => save({ ...store, gallery })}>Save gallery</button>
    </div>
  );
}
