import { isVideoSrc } from "@/lib/video";

export function SignSamplesPanel({ urls }: { urls: string[] }) {
  const photos = urls.filter((src) => src && !isVideoSrc(src));

  return (
    <div className="card" style={{ padding: 16 }}>
      <p className="section-kicker">Live site</p>
      <h2>I want this samples</h2>
      <p className="note">
        These are the pictures with the “I want this” button on the Signs page. Open one to see the full image.
        Add or remove them under Custom size &amp; rate, then save.
      </p>
      {photos.length ? (
        <div className="mc-sign-samples">
          {photos.map((src, i) => (
            <figure key={`${src}-${i}`} className="mc-sign-sample">
              <a href={src} target="_blank" rel="noreferrer">
                <img src={src} alt={`Sign sample ${i + 1}`} />
              </a>
              <a className="btn" href={src} target="_blank" rel="noreferrer">
                Open full image
              </a>
            </figure>
          ))}
        </div>
      ) : (
        <p className="muted">No sample photos yet. Add them under Custom size &amp; rate.</p>
      )}
    </div>
  );
}
