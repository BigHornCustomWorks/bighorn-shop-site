import Link from "next/link";
import { readStore } from "@/lib/store";

export default async function GalleryPage() {
  const store = await readStore();
  const sections = (store.gallery || []).filter((s) => s.visible).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="wrap gallery-page">
      <p className="back-row"><Link className="back-link" href="/">Home</Link></p>
      <p className="section-kicker">Photo gallery</p>
      <h1>Work in the wild</h1>
      <p className="lede">CNC signs on homes and businesses. Not a catalog.</p>
      {sections.map((section) => (
        <section key={section.id} className="gallery-section">
          <div className="gallery-section-head">
            <h2>{section.title}</h2>
            {section.subtitle ? <p className="gallery-section-sub">{section.subtitle}</p> : null}
          </div>

          {section.photos.length ? (
            <div className="gallery-grid">
              {section.photos.map((photo) => (
                <figure key={photo.id} className="gallery-card">
                  <img src={photo.src} alt={photo.alt || photo.caption || section.title} />
                  {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : (
            <div className="gallery-empty card">
              <p className="section-kicker">Coming soon</p>
              <h3>{section.title}</h3>
              <p className="muted">Ready for photos. Nothing listed yet.</p>
              <Link className="btn" href="/custom">Request a custom sign quote</Link>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
