"use client";

import { useEffect, useState } from "react";
import { compressImage } from "@/lib/compressImage";
import { formatUsd } from "@/lib/money";
import { SERVER_UPLOAD_MAX, humanSize, maxForKind, safeUploadName } from "@/lib/uploadLimits";
import { newId, safeSlug } from "@/lib/sanitize";
import { fileUploadKind, firstPhoto, orderedMedia } from "@/lib/video";
import { CARRIERS } from "@/lib/tracking";
import type {
  PackagePreset,
  Product,
  ProductKind,
  Quote,
  ShipAddress,
  ShopCategory,
  ShopOrder,
  ShopStore,
} from "@/lib/types";
import { GalleryTab } from "@/components/GalleryTab";
import { MediaField } from "@/components/MediaField";
import { MoneyInput } from "@/components/MoneyInput";
import { SignsTab } from "@/components/SignsTab";
import { TrafficTab } from "@/components/TrafficTab";
import { shopDay, sumDays, daysAgo } from "@/lib/visit-stats";

type Tab = "physical" | "digital" | "signs" | "gallery" | "copy" | "quotes" | "traffic" | "settings";

const emptyProduct = (kind: ProductKind = "physical"): Product => ({
  id: newId("prod"),
  slug: "",
  name: "",
  priceCents: 0,
  description: "",
  media: [],
  photos: [],
  videos: [],
  category: kind === "digital" ? "Digital" : kind === "sign" ? "Metal signs" : "Mill accessories",
  kind,
  digitalNote: "",
  variants: [],
  variantNote: "",
  visible: true,
  stripeProductId: "",
  stripePriceId: "",
  stripePriceCents: 0,
  stripeTaxBehavior: "",
  shippingCents: 0,
  weightOz: 0,
  weightUnit: "oz",
  packagePresetId: "",
  lengthIn: 0,
  widthIn: 0,
  heightIn: 0,
  boxWeightOz: 0,
  priceLabel: "",
  externalUrl: "",
  sortOrder: 99,
});

const SHIP_FROM_FIELDS: { key: keyof ShipAddress; label: string }[] = [
  { key: "company", label: "Business name" },
  { key: "name", label: "Contact name" },
  { key: "street1", label: "Street" },
  { key: "street2", label: "Suite / unit (optional)" },
  { key: "city", label: "City" },
  { key: "state", label: "State (2 letters)" },
  { key: "zip", label: "ZIP" },
  { key: "phone", label: "Phone (UPS requires one)" },
  { key: "email", label: "Email (optional)" },
];

export function MasterClient() {
  const [tab, setTab] = useState<Tab>("physical");
  const [store, setStore] = useState<ShopStore | null>(null);
  const [persistence, setPersistence] = useState("");
  const [storageDurable, setStorageDurable] = useState(true);
  const [blobNote, setBlobNote] = useState("");
  const [keyMode, setKeyMode] = useState("");
  const [envStripe, setEnvStripe] = useState(false);
  const [envResend, setEnvResend] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [stripeKeyDraft, setStripeKeyDraft] = useState("");
  const [envSmtp, setEnvSmtp] = useState(false);
  const [shippoMode, setShippoMode] = useState("");
  const [shipFromSource, setShipFromSource] = useState("");
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [dragCat, setDragCat] = useState<number | null>(null);
  const [dragProd, setDragProd] = useState<string | null>(null);
  const [heroVideoFile, setHeroVideoFile] = useState<File | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);

  useEffect(() => {
    fetch("/api/master/store")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/master/login";
          return;
        }
        const json = await res.json();
        setStore(json.store);
        setPersistence(json.persistence || "");
        setStorageDurable(json.storageDurable !== false);
        if (json.blob) {
          const b = json.blob;
          setBlobNote(
            b.error
              ? "Blob check failed: " + b.error
              : b.readOk
                ? "Blob reachable" + (b.found ? ", store file found." : ", no store file yet.")
                : "",
          );
        }
        setKeyMode(json.stripeKeyMode || "");
        setEnvStripe(Boolean(json.envStripe));
        setEnvResend(Boolean(json.envResend));
        setEnvSmtp(Boolean(json.envSmtp));
        setShippoMode(json.shippoMode || "");
        setShipFromSource(json.shipFromSource || "");
      })
      .catch(() => setError("Could not load Master Control."));
  }, []);

  async function save(next: ShopStore, extra?: { stripeSecretKey?: string }) {
    setStatus("Saving…");
    setError("");
    // Commit locally BEFORE the request, never after. A save can take seconds
    // (it talks to Stripe), and applying this snapshot on the way back threw
    // away everything typed in the meantime — text fields appeared to revert.
    setStore(next);
    const payload = extra?.stripeSecretKey
      ? { ...next, settings: { ...next.settings, stripeSecretKey: extra.stripeSecretKey } }
      : next;
    const res = await fetch("/api/master/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store: payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Save failed.");
      setStatus("");
      return;
    }
    setPersistence(json.persistence || json.persisted || persistence);
    const stripeNote = json.stripeError
      ? ` Stripe: ${json.stripeError}`
      : json.stripeSynced
        ? ` Stripe catalog updated (${json.stripeSynced} item${json.stripeSynced === 1 ? "" : "s"}).`
        : "";
    setStorageDurable(json.storageDurable !== false);
    if (json.stripeKeyMode) setKeyMode(json.stripeKeyMode);
    setStatus(`Saved (${json.persisted || "ok"}). Shop page reads this without a deploy.${stripeNote}`);
    if (json.ok === false) {
      setError(
        "Saved to memory only — this will be lost on the next cold start. Reason: " +
          (json.storageError || "unknown") +
          ".",
      );
    } else if (json.stripeError) {
      setError(json.stripeError);
    }
  }

  /**
   * Sends the file straight to Vercel Blob so it never passes through a
   * serverless function, which is what the 4.5 MB cap actually applies to.
   * Falls back to the old server route (local dev, or no Blob token) where that
   * cap is real. Returns "" and sets the error message on failure.
   */
  async function uploadFile(file: File, kind: string): Promise<string> {
    const fallbackName = kind === "video" ? "clip.mp4" : "photo.jpg";
    const pathname = "bhcw/" + kind + "s/" + safeUploadName(file.name, fallbackName);
    try {
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        clientPayload: kind,
        contentType: file.type || undefined,
      });
      if (blob?.url) return blob.url;
    } catch {
      /* fall through to the server route */
    }

    if (file.size > SERVER_UPLOAD_MAX) {
      setError(
        "Direct upload failed, and " +
          humanSize(file.size) +
          " is too big for the backup route. Try a smaller file, or paste a URL.",
      );
      return "";
    }
    const data = new FormData();
    data.set("file", file);
    data.set("kind", kind);
    const res = await fetch("/api/master/upload", { method: "POST", body: data });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      setError(json.error || "Upload failed. Paste a URL instead.");
      return "";
    }
    return json.url;
  }

  async function uploadTo(productId: string, file: File) {
    const kind = fileUploadKind(file);
    setError("");
    setStatus("Uploading…");

    // Shrink photos first: a 9 MB phone shot becomes a few hundred KB with no
    // visible difference on a shop page.
    const toSend = kind === "video" ? file : await compressImage(file);

    const max = maxForKind(kind);
    if (toSend.size > max) {
      setStatus("");
      setError("That " + kind + " is " + humanSize(toSend.size) + " and the limit is " + humanSize(max) + ".");
      return;
    }

    const url = await uploadFile(toSend, kind);
    if (!url || !store) {
      setStatus("");
      return;
    }
    const products = store.products.map((p) => {
      if (p.id !== productId) return p;
      return { ...p, media: [...orderedMedia(p), url] };
    });
    await save({ ...store, products });
  }

  async function uploadHeroVideo(file: File) {
    if (!store) return;
    setHeroUploading(true);
    setError("");
    const data = new FormData();
    data.set("file", file);
    data.set("kind", "video");
    try {
      const res = await fetch("/api/master/upload", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || "Hero video upload failed. Keep it under 40MB.");
        return;
      }
      const next = { ...store, site: { ...store.site, heroVideoUrl: json.url } };
      await save(next);
      setHeroVideoFile(null);
    } finally {
      setHeroUploading(false);
    }
  }

  if (!store) {
    return (
      <div className="master">
        <h1>Master Control</h1>
        <p>{error || "Loading…"}</p>
      </div>
    );
  }

  const unread =
    store.quotes.filter((q) => !q.read).length + (store.orders || []).filter((o) => !o.read).length;

  const productTabProps = {
    store,
    setStore,
    save,
    uploadTo,
    query,
    setQuery,
    filterCat,
    setFilterCat,
    openId,
    setOpenId,
    newCat,
    setNewCat,
    dragCat,
    setDragCat,
    dragProd,
    setDragProd,
  };

  return (
    <div className="master">
      <div className="mc-section-head">
        <p className="section-kicker">Master Control</p>
        <h1>Shop editor</h1>
        <p className="lede">
          Same doors as the public site — Physical, Digital, and Metal signs. Edit copy, photos, prices, and the sign
          rate without a deploy.
        </p>
      </div>
      <p className="note">Storage: {persistence}</p>
      {storageDurable ? null : (
        <p className="err">
          Storage is not durable — orders and edits here will disappear. Connect a Vercel Blob store
          (BLOB_READ_WRITE_TOKEN) before going live.
        </p>
      )}
      {blobNote ? <p className="note">{blobNote}</p> : null}
      {(() => {
        const days = store.stats?.days || [];
        const today = days.find((d) => d.date === shopDay());
        const week = sumDays(days, daysAgo(6));
        return (
          <div className="mc-stat-grid mc-stat-strip">
            <button type="button" className="mc-stat" onClick={() => setTab("traffic")}>
              <p className="mc-stat-label">Today</p>
              <p className="mc-stat-num">{(today?.uniqueVisitors || 0).toLocaleString("en-US")}</p>
              <p className="muted">unique · {(today?.pageViews || 0).toLocaleString("en-US")} views</p>
            </button>
            <button type="button" className="mc-stat" onClick={() => setTab("traffic")}>
              <p className="mc-stat-label">Last 7 days</p>
              <p className="mc-stat-num">{week.uniqueVisitors.toLocaleString("en-US")}</p>
              <p className="muted">{week.pageViews.toLocaleString("en-US")} page views</p>
            </button>
            <button type="button" className="mc-stat" onClick={() => setTab("traffic")}>
              <p className="mc-stat-label">All time</p>
              <p className="mc-stat-num">{(store.stats?.uniqueVisitors || 0).toLocaleString("en-US")}</p>
              <p className="muted">{(store.stats?.pageViews || 0).toLocaleString("en-US")} page views</p>
            </button>
            <button type="button" className="mc-stat" onClick={() => setTab("traffic")}>
              <p className="mc-stat-label">From Facebook</p>
              <p className="mc-stat-num">{(store.stats?.sources?.facebook || 0).toLocaleString("en-US")}</p>
              <p className="muted">page views</p>
            </button>
          </div>
        );
      })()}
      <div className="mc-tabs">
        {(
          [
            ["physical", "Physical"],
            ["digital", "Digital"],
            ["signs", "Metal signs"],
            ["gallery", "Gallery"],
            ["copy", "Site copy"],
            ["quotes", `Inbox${unread ? ` (${unread})` : ""}`],
            ["traffic", "Traffic"],
            ["settings", "Settings"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "on" : ""}
            type="button"
            onClick={() => {
              setTab(id);
              setOpenId(null);
              setFilterCat("all");
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/master/logout", { method: "POST" });
            window.location.href = "/master/login";
          }}
        >
          Log out
        </button>
      </div>
      {status ? <p className="ok">{status}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {tab === "physical" ? (
        <ProductsTab kind="physical" heading="Parts & fab goods" kicker="Physical products" {...productTabProps} />
      ) : null}

      {tab === "digital" ? (
        <ProductsTab kind="digital" heading="Software & tools" kicker="Digital products" {...productTabProps} />
      ) : null}

      {tab === "signs" ? (
        <>
          <SignsTab store={store} setStore={setStore} save={save} uploadFile={uploadFile} />
          <ProductsTab kind="sign" heading="Fixed-size sign SKUs" kicker="Optional catalog" {...productTabProps} />
        </>
      ) : null}

      {tab === "gallery" ? (
        <GalleryTab store={store} setStore={setStore} save={save} uploadFile={uploadFile} />
      ) : null}

      {tab === "copy" ? (
        <div className="form" style={{ maxWidth: 760 }}>
          <label>
            Company name
            <input value={store.site.companyName} onChange={(e) => setStore({ ...store, site: { ...store.site, companyName: e.target.value } })} />
          </label>
          <label>
            Legal name
            <input value={store.site.legalName} onChange={(e) => setStore({ ...store, site: { ...store.site, legalName: e.target.value } })} />
          </label>
          <label>
            Tagline line 1
            <input value={store.site.taglineLine1} onChange={(e) => setStore({ ...store, site: { ...store.site, taglineLine1: e.target.value } })} />
          </label>
          <label>
            Tagline line 2
            <input value={store.site.taglineLine2} onChange={(e) => setStore({ ...store, site: { ...store.site, taglineLine2: e.target.value } })} />
          </label>
          <label>
            Tagline line 3
            <input value={store.site.taglineLine3} onChange={(e) => setStore({ ...store, site: { ...store.site, taglineLine3: e.target.value } })} />
          </label>
          <label>
            Who we are
            <textarea value={store.site.whoWeAre} onChange={(e) => setStore({ ...store, site: { ...store.site, whoWeAre: e.target.value } })} />
          </label>
          <label>
            What we make
            <textarea value={store.site.whatWeMake} onChange={(e) => setStore({ ...store, site: { ...store.site, whatWeMake: e.target.value } })} />
          </label>
          <label>
            About page
            <textarea value={store.site.aboutBody} onChange={(e) => setStore({ ...store, site: { ...store.site, aboutBody: e.target.value } })} />
          </label>
          <label>
            Contact email
            <input value={store.site.contactEmail} onChange={(e) => setStore({ ...store, site: { ...store.site, contactEmail: e.target.value } })} />
          </label>
          <label>
            LinkedIn URL
            <input value={store.site.linkedinUrl} onChange={(e) => setStore({ ...store, site: { ...store.site, linkedinUrl: e.target.value } })} />
          </label>
          <label>
            Location
            <input value={store.site.location} onChange={(e) => setStore({ ...store, site: { ...store.site, location: e.target.value } })} />
          </label>
          <label>
            Shipping note
            <textarea value={store.site.shippingNote} onChange={(e) => setStore({ ...store, site: { ...store.site, shippingNote: e.target.value } })} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={store.site.pickupEnabled !== false}
              onChange={(e) =>
                setStore({ ...store, site: { ...store.site, pickupEnabled: e.target.checked } })
              }
            />
            Offer local pickup (no shipping)
          </label>
          {store.site.pickupEnabled !== false ? (
            <label>
              Pickup label on Stripe
              <input
                value={store.site.pickupLabel || ""}
                onChange={(e) => setStore({ ...store, site: { ...store.site, pickupLabel: e.target.value } })}
                placeholder="Local pickup — Sheridan, WY"
              />
            </label>
          ) : null}
          <div>
            <p>
              <strong>Shipping options</strong>
            </p>
            <p className="note">
              What the customer picks from on the Stripe payment page, up to 5 including pickup. Charge what the label
              plus packaging actually costs you. Leave the day estimates at 0 to hide them.
            </p>
            {store.site.shippingOptions.length === 0 ? (
              <p className="err">
                No shipping options set — customers are not being charged shipping. Add at least one before going live.
              </p>
            ) : null}
            {store.site.shippingOptions.map((opt, i) => {
              const patch = (fields: Partial<typeof opt>) =>
                setStore({
                  ...store,
                  site: {
                    ...store.site,
                    shippingCents: 0,
                    shippingOptions: store.site.shippingOptions.map((o, idx) =>
                      idx === i ? { ...o, ...fields } : o,
                    ),
                  },
                });
              return (
                <div key={opt.id}>
                  <label>
                    Service name
                    <input
                      placeholder="USPS Priority Mail"
                      value={opt.label}
                      onChange={(e) => patch({ label: e.target.value })}
                    />
                  </label>
                  <label>
                    Price ({formatUsd(opt.amountCents)})
                    <MoneyInput cents={opt.amountCents} onCents={(amountCents) => patch({ amountCents })} />
                  </label>
                  <label>
                    Fastest (business days)
                    <input
                      type="number"
                      min={0}
                      value={opt.minDays}
                      onChange={(e) => patch({ minDays: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label>
                    Slowest (business days)
                    <input
                      type="number"
                      min={0}
                      value={opt.maxDays}
                      onChange={(e) => patch({ maxDays: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setStore({
                        ...store,
                        site: {
                          ...store.site,
                          shippingCents: 0,
                          shippingOptions: store.site.shippingOptions.filter((_, idx) => idx !== i),
                        },
                      })
                    }
                  >
                    Remove {opt.label || "option"}
                  </button>
                </div>
              );
            })}
            {store.site.shippingOptions.length < 5 ? (
              <button
                type="button"
                onClick={() =>
                  setStore({
                    ...store,
                    site: {
                      ...store.site,
                      shippingCents: 0,
                      shippingOptions: [
                        ...store.site.shippingOptions,
                        { id: newId("ship"), label: "", amountCents: 0, minDays: 0, maxDays: 0 },
                      ],
                    },
                  })
                }
              >
                Add shipping option
              </button>
            ) : null}
          </div>
          <label>
            Repair Status label
            <input value={store.site.repairStatusLabel} onChange={(e) => setStore({ ...store, site: { ...store.site, repairStatusLabel: e.target.value } })} />
          </label>
          <label>
            Repair Status line (text link, not a product)
            <textarea value={store.site.repairStatusLine} onChange={(e) => setStore({ ...store, site: { ...store.site, repairStatusLine: e.target.value } })} />
          </label>
          <label>
            Repair Status URL
            <input value={store.site.repairStatusUrl} onChange={(e) => setStore({ ...store, site: { ...store.site, repairStatusUrl: e.target.value } })} />
          </label>
          <label>
            Logo URL
            <input value={store.site.logoUrl} onChange={(e) => setStore({ ...store, site: { ...store.site, logoUrl: e.target.value } })} />
          </label>
          <label>
            Hero photo URL (still that shows after the clip, and on later visits)
            <input value={store.site.heroUrl} onChange={(e) => setStore({ ...store, site: { ...store.site, heroUrl: e.target.value } })} />
          </label>
          <p className="note">
            Hero intro video — plays once on a visitor’s first visit (muted), then the still shows.
          </p>
          {store.site.heroVideoUrl ? (
            <div>
              <video src={store.site.heroVideoUrl} controls playsInline style={{ maxWidth: "100%", maxHeight: 240 }} />
              <p className="muted">{store.site.heroVideoUrl}</p>
              <button
                type="button"
                onClick={() => {
                  const next = { ...store, site: { ...store.site, heroVideoUrl: "" } };
                  setStore(next);
                  save(next);
                }}
              >
                Remove video
              </button>
            </div>
          ) : (
            <p className="muted">No hero video uploaded yet.</p>
          )}
          <label>
            Choose hero video (mp4 / webm, under 40MB)
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={(e) => setHeroVideoFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={!heroVideoFile || heroUploading}
            onClick={() => heroVideoFile && uploadHeroVideo(heroVideoFile)}
          >
            {heroUploading
              ? "Uploading…"
              : heroVideoFile
                ? `Upload hero video (${heroVideoFile.name})`
                : "Upload hero video"}
          </button>
          <label>
            Or paste hero video URL
            <input
              value={store.site.heroVideoUrl || ""}
              onChange={(e) => setStore({ ...store, site: { ...store.site, heroVideoUrl: e.target.value } })}
              placeholder="https://… or /uploads/…"
            />
          </label>
          <label>
            Footer note
            <input value={store.site.footerNote} onChange={(e) => setStore({ ...store, site: { ...store.site, footerNote: e.target.value } })} />
          </label>
          <button className="btn btn-bronze" type="button" onClick={() => save(store)}>
            Save copy
          </button>
        </div>
      ) : null}

      {tab === "quotes" ? (
        <div>
          <h2>Orders</h2>
          {!(store.orders && store.orders.length) ? (
            <p>No catalog orders yet. Paid Stripe checkouts land here even if email fails.</p>
          ) : (
            store.orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onRead={() => {
                  const orders = store.orders.map((o) => (o.id === order.id ? { ...o, read: true } : o));
                  save({ ...store, orders });
                }}
                onShipped={(fields) => {
                  // The ship route already wrote this server-side; just mirror
                  // it locally so the row updates without a full store PUT.
                  setStore({
                    ...store,
                    orders: store.orders.map((o) => (o.id === order.id ? { ...o, ...fields } : o)),
                  });
                }}
              />
            ))
          )}
          <h2>Quotes</h2>
          {!store.quotes.length ? <p>No quote requests yet.</p> : null}
          {store.quotes.map((quote) => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              onRead={() => {
                const quotes = store.quotes.map((q) => (q.id === quote.id ? { ...q, read: true } : q));
                save({ ...store, quotes });
              }}
            />
          ))}
        </div>
      ) : null}

      {tab === "traffic" ? <TrafficTab stats={store.stats} /> : null}

      {tab === "settings" ? (
        <div className="form" style={{ maxWidth: 760 }}>
          <div className="banner">{store.site.shopFloorNotes}</div>
          <label>
            Shop-floor notes (only you see these)
            <textarea value={store.site.shopFloorNotes} onChange={(e) => setStore({ ...store, site: { ...store.site, shopFloorNotes: e.target.value } })} />
          </label>
          <p>
            Stripe env key: {envStripe ? "set" : "missing"} · Key in use:{" "}
            <strong>{keyMode || "unknown"}</strong> · Label: {store.settings.stripeMode}
          </p>
          {keyMode === "test" ? (
            <p className="note">
              Stripe account can take live charges, but this site is still on <strong>test</strong> keys. Checkout
              charges the Master Control price — you do not enter prices in the Stripe Dashboard. To go live, put the
              live publishable and secret keys in the same keys file you used last time (pk_live_ / sk_live_), then tell
              me. Real cards will fail until that swap.
            </p>
          ) : null}
          {keyMode && keyMode !== store.settings.stripeMode ? (
            <p className="err">
              The mode label says “{store.settings.stripeMode}” but the key actually in use is {keyMode}. The key is
              what counts — set STRIPE_SECRET_KEY in Vercel to change it.
            </p>
          ) : null}
          <p className="note">
            Saving products also creates or updates them in Stripe (name, price, photos). Checkout uses those Stripe
            prices. Variants (like T-slot color) stay on this site and show on the Stripe payment page.
          </p>
          <label>
            Shipping on multi-item orders
            <select
              value={store.settings.shippingCombine}
              onChange={(e) =>
                setStore({
                  ...store,
                  settings: {
                    ...store.settings,
                    shippingCombine: e.target.value === "sum" ? "sum" : "highest",
                  },
                })
              }
            >
              <option value="highest">Charge the dearest item only (ships together)</option>
              <option value="sum">Add up every item (each needs its own box)</option>
            </select>
          </label>
          <label>
            Shipping name customers see
            <input
              value={store.site.perItemShippingLabel}
              onChange={(e) =>
                setStore({ ...store, site: { ...store.site, perItemShippingLabel: e.target.value } })
              }
            />
          </label>
          <p className="note">
            Any item with its own shipping cost takes over from the shop-wide rates for that order.
            Items left at 0 ship along free. If no item in the cart has a cost set, the shop-wide
            options above are used instead.
          </p>
          <h3>Live shipping rates (Shippo)</h3>
          <p>
            Shippo key:{" "}
            <strong>
              {shippoMode === "test"
                ? "TEST key (no real postage)"
                : shippoMode === "live"
                  ? "LIVE key (labels cost real money)"
                  : shippoMode === "unknown"
                    ? "set, but not a shippo_test_ / shippo_live_ key"
                    : "not set (SHIPPO_API_KEY)"}
            </strong>{" "}
            · Ship-from:{" "}
            <strong>
              {shipFromSource === "settings"
                ? "saved below"
                : shipFromSource === "env"
                  ? "from SHIP_FROM_* env vars"
                  : "MISSING"}
            </strong>
          </p>
          <p className="note">
            Live USPS/UPS rates show in the cart only when the key is set, a ship-from address is on file, and
            every item in the cart has an item weight and a box (a preset below, or its own size). Otherwise checkout uses the flat rates above,
            exactly as before. Use the business address — leave these blank to use the SHIP_FROM_* env vars.
            A saved address here wins over the env vars only when street, city, state and ZIP are all filled.
          </p>
          {SHIP_FROM_FIELDS.map(({ key, label }) => (
            <label key={key}>
              Ship-from {label.charAt(0).toLowerCase() + label.slice(1)}
              <input
                value={store.settings.shipFrom?.[key] || ""}
                onChange={(e) =>
                  setStore({
                    ...store,
                    settings: {
                      ...store.settings,
                      shipFrom: { ...store.settings.shipFrom, [key]: e.target.value },
                    },
                  })
                }
              />
            </label>
          ))}
          <PresetsEditor
            presets={store.settings.packagePresets || []}
            allowanceOz={store.settings.packagingAllowanceOz}
            onChange={(packagePresets, packagingAllowanceOz) =>
              setStore({ ...store, settings: { ...store.settings, packagePresets, packagingAllowanceOz } })
            }
          />
          <label>
            <input
              type="checkbox"
              checked={store.settings.taxEnabled}
              onChange={(e) =>
                setStore({ ...store, settings: { ...store.settings, taxEnabled: e.target.checked } })
              }
            />{" "}
            Let Stripe calculate and collect sales tax
          </label>
          <p className="note">
            Turn this on only after Stripe Tax is switched on in the Stripe Dashboard, with the Sheridan origin
            address and your registrations added. If it is on here but not set up there, checkout will fail. Stripe
            charges a fee per taxed transaction.
          </p>
          <label>
            Stripe mode
            <select
              value={store.settings.stripeMode}
              onChange={(e) =>
                setStore({
                  ...store,
                  settings: { ...store.settings, stripeMode: e.target.value === "live" ? "live" : "test" },
                })
              }
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label>
            Stripe secret key override (sk_test / sk_live / rk_). Leave blank to use env.
            <input
              type="password"
              value={stripeKeyDraft}
              onChange={(e) => setStripeKeyDraft(e.target.value)}
              placeholder={store.settings.stripeSecretKey ? "•••• already saved" : "Paste key"}
            />
          </label>
          <p className="note">
            Clint keeps his own processor. This site does not process shop payments as a platform — Stripe Checkout is
            your catalog checkout. Quote jobs stay off the cart.
          </p>
          <p className="note">
            Quote emails go to the contact email above (and QUOTE_TO_EMAIL). SMTP: {envSmtp ? "set" : "not set"}.
            Resend: {envResend ? "set" : "not set"}. If neither is set, the first quote sends a FormSubmit
            confirmation to {store.site.contactEmail} — click that once, then new requests email you.
          </p>
          <button
            className="btn btn-bronze"
            type="button"
            onClick={() => save(store, stripeKeyDraft ? { stripeSecretKey: stripeKeyDraft } : undefined)}
          >
            Save settings
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProductsTab({
  kind,
  heading,
  kicker,
  store,
  setStore,
  save,
  uploadTo,
  query,
  setQuery,
  filterCat,
  setFilterCat,
  openId,
  setOpenId,
  newCat,
  setNewCat,
  dragCat,
  setDragCat,
  dragProd,
  setDragProd,
}: {
  kind: ProductKind;
  heading: string;
  kicker: string;
  store: ShopStore;
  setStore: (s: ShopStore) => void;
  save: (s: ShopStore) => Promise<void>;
  uploadTo: (id: string, file: File) => Promise<void>;
  query: string;
  setQuery: (v: string) => void;
  filterCat: string;
  setFilterCat: (v: string) => void;
  openId: string | null;
  setOpenId: (v: string | null) => void;
  newCat: string;
  setNewCat: (v: string) => void;
  dragCat: number | null;
  setDragCat: (v: number | null) => void;
  dragProd: string | null;
  setDragProd: (v: string | null) => void;
}) {
  const categories = store.categories || [];
  const q = query.trim().toLowerCase();
  const listed = store.products.filter((p) => {
    if (p.kind !== kind) return false;
    if (filterCat !== "all" && p.category !== filterCat) return false;
    if (!q) return true;
    return `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q);
  });
  const open = store.products.find((p) => p.id === openId && p.kind === kind);

  function reorderCats(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...categories];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setStore({ ...store, categories: next.map((c, i) => ({ ...c, sortOrder: i + 1 })) });
  }

  function reorderProds(fromId: string, toId: string) {
    if (fromId === toId) return;
    const group = store.products.filter((p) => p.kind === kind);
    const rest = store.products.filter((p) => p.kind !== kind);
    const from = group.findIndex((p) => p.id === fromId);
    const to = group.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0) return;
    const nextGroup = [...group];
    const [item] = nextGroup.splice(from, 1);
    nextGroup.splice(to, 0, item);
    setStore({
      ...store,
      products: [...nextGroup, ...rest].map((p, i) => ({ ...p, sortOrder: i + 1 })),
    });
  }

  const addLabel =
    kind === "digital" ? "Add digital product" : kind === "sign" ? "Add sign SKU" : "Add physical product";

  return (
    <div>
      <div className="mc-section-head">
        <p className="section-kicker">{kicker}</p>
        <h2>{heading}</h2>
        <p className="note">
          {kind === "sign"
            ? "Optional ready-to-order signs with a fixed price. Custom sizes use the rate above, not these SKUs."
            : "Categories you add here show on the shop once they have a visible product. Drag a chip or a card to reorder."}
        </p>
      </div>
      <div className="mc-cat-row">
        <button
          type="button"
          className={filterCat === "all" ? "mc-cat-chip on" : "mc-cat-chip"}
          onClick={() => setFilterCat("all")}
        >
          All
        </button>
        {categories.map((c, i) => (
          <span
            key={c.id}
            className={filterCat === c.name ? "mc-cat-chip on" : "mc-cat-chip"}
            draggable
            onDragStart={() => setDragCat(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragCat == null) return;
              reorderCats(dragCat, i);
              setDragCat(null);
            }}
          >
            <button type="button" onClick={() => setFilterCat(c.name)}>
              {c.name}
            </button>
            <button
              type="button"
              title="Remove category"
              onClick={() => {
                const next = categories.filter((x) => x.id !== c.id);
                setStore({ ...store, categories: next.map((x, n) => ({ ...x, sortOrder: n + 1 })) });
                if (filterCat === c.name) setFilterCat("all");
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="New category (Office, Tools…)"
        />
        <button
          type="button"
          className="btn"
          onClick={() => {
            const name = newCat.trim();
            if (!name) return;
            if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
              setNewCat("");
              return;
            }
            const cat: ShopCategory = {
              id: `cat_${Date.now().toString(36)}`,
              name,
              sortOrder: categories.length + 1,
            };
            setStore({ ...store, categories: [...categories, cat] });
            setNewCat("");
            setFilterCat(name);
          }}
        >
          Add category
        </button>
      </div>

      <label className="search-box">
        Search products
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or category" />
      </label>

      <div className="hero-actions" style={{ marginBottom: 10 }}>
        <button
          className="btn"
          type="button"
          onClick={() => {
            const p = emptyProduct(kind);
            p.sortOrder = store.products.length + 1;
            if (filterCat !== "all") p.category = filterCat;
            setStore({ ...store, products: [...store.products, p] });
            setOpenId(p.id);
          }}
        >
          {addLabel}
        </button>
        <button className="btn btn-bronze" type="button" onClick={() => save(store)}>
          Save products
        </button>
      </div>

      <div className="mc-product-grid">
        {listed.map((product) => (
          <button
            key={product.id}
            type="button"
            className={openId === product.id ? "mc-product-card open" : "mc-product-card"}
            draggable
            onDragStart={() => setDragProd(product.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragProd) reorderProds(dragProd, product.id);
              setDragProd(null);
            }}
            onClick={() => setOpenId(openId === product.id ? null : product.id)}
          >
            <img src={firstPhoto(product) || "/logo.png"} alt="" />
            <div className="pad">
              <p className="card-meta">
                {product.category}
                {product.kind === "digital" ? " · Digital" : product.kind === "sign" ? " · Metal sign" : ""}
              </p>
              <h3>{product.name || "Untitled"}</h3>
              <p className="price">{formatUsd(product.priceCents)}</p>
            </div>
          </button>
        ))}
      </div>

      {open ? (
        <ProductEditor
          product={open}
          categories={categories}
          presets={store.settings.packagePresets || []}
          onChange={(next) => {
            setStore({
              ...store,
              products: store.products.map((p) => (p.id === next.id ? next : p)),
            });
          }}
          onMove={(dir) => {
            const products = [...store.products];
            const index = products.findIndex((p) => p.id === open.id);
            const j = index + dir;
            if (index < 0 || j < 0 || j >= products.length) return;
            [products[index], products[j]] = [products[j], products[index]];
            setStore({
              ...store,
              products: products.map((p, i) => ({ ...p, sortOrder: i + 1 })),
            });
          }}
          onUpload={(file) => uploadTo(open.id, file)}
        />
      ) : (
        <p className="note">Click a card to edit. Drag cards to reorder. Save when you are done.</p>
      )}
    </div>
  );
}

/** Decimal from a number input; blank or junk becomes 0 ("not set"). */
function numIn(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Item weight and box for live carrier rates. Weight is stored in ounces; the
 * unit picker only changes how it is typed and shown. The box is a preset
 * from Settings unless all three override dimensions are filled in.
 */
function PackageFields({
  product,
  presets,
  onChange,
}: {
  product: Product;
  presets: PackagePreset[];
  onChange: (p: Product) => void;
}) {
  const unit = product.weightUnit === "lb" ? "lb" : "oz";
  const shown = unit === "lb" ? Math.round((product.weightOz / 16) * 1000) / 1000 : product.weightOz;
  const override = product.lengthIn > 0 && product.widthIn > 0 && product.heightIn > 0;
  const preset = presets.find((p) => p.id === product.packagePresetId);
  const boxReady = override || Boolean(preset && preset.lengthIn > 0 && preset.widthIn > 0 && preset.heightIn > 0);
  const measured = product.weightOz > 0 && boxReady;
  return (
    <>
      <label>
        Item weight, no box ({unit})
        <span style={{ display: "flex", gap: 6 }}>
          <input
            type="number"
            min={0}
            step="0.1"
            value={shown || ""}
            placeholder="0"
            onChange={(e) => {
              const v = numIn(e.target.value);
              onChange({ ...product, weightOz: unit === "lb" ? Math.round(v * 16 * 100) / 100 : v });
            }}
          />
          <select
            value={unit}
            onChange={(e) => onChange({ ...product, weightUnit: e.target.value === "lb" ? "lb" : "oz" })}
          >
            <option value="oz">oz</option>
            <option value="lb">lb</option>
          </select>
        </span>
      </label>
      <label>
        Ships in box
        <select
          value={product.packagePresetId}
          onChange={(e) => onChange({ ...product, packagePresetId: e.target.value })}
        >
          <option value="">— pick a box preset —</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.lengthIn}×{p.widthIn}×{p.heightIn} in, {p.emptyWeightOz} oz empty)
            </option>
          ))}
        </select>
        {!presets.length ? <span className="muted">Add box presets in Settings.</span> : null}
      </label>
      <label>
        Own box size instead (optional) L × W × H in
        <span style={{ display: "flex", gap: 6 }}>
          {(["lengthIn", "widthIn", "heightIn"] as const).map((key) => (
            <input
              key={key}
              type="number"
              min={0}
              step="0.1"
              aria-label={key.replace("In", "")}
              value={product[key] || ""}
              placeholder={key.charAt(0).toUpperCase()}
              onChange={(e) => onChange({ ...product, [key]: numIn(e.target.value) })}
            />
          ))}
        </span>
      </label>
      {override ? (
        <label>
          Own box empty weight (oz)
          <input
            type="number"
            min={0}
            step="0.1"
            value={product.boxWeightOz || ""}
            placeholder="0"
            onChange={(e) => onChange({ ...product, boxWeightOz: numIn(e.target.value) })}
          />
        </label>
      ) : null}
      <p className="muted" style={{ gridColumn: "1 / -1" }}>
        {measured
          ? `Live USPS/UPS rates on. Box: ${override ? "this product's own size" : preset?.name}.`
          : "Needs an item weight and a box (preset or own size) for live rates — until then this item uses the flat shipping rates."}
      </p>
    </>
  );
}

/** Reusable shipping boxes, edited in Settings. */
function PresetsEditor({
  presets,
  allowanceOz,
  onChange,
}: {
  presets: PackagePreset[];
  allowanceOz: number;
  onChange: (presets: PackagePreset[], allowanceOz: number) => void;
}) {
  const patch = (i: number, fields: Partial<PackagePreset>) =>
    onChange(
      presets.map((p, idx) => (idx === i ? { ...p, ...fields } : p)),
      allowanceOz,
    );
  return (
    <div>
      <h3>Box presets</h3>
      <p className="note">
        Boxes you reuse. Each product picks one and adds its own item weight. Parcel weight = item weight + empty
        box weight + the packaging allowance below.
      </p>
      {presets.map((p, i) => (
        <div key={p.id} className="row-3" style={{ alignItems: "end", marginBottom: 8 }}>
          <label>
            Name
            <input value={p.name} placeholder="Small flat box" onChange={(e) => patch(i, { name: e.target.value })} />
          </label>
          <label>
            L × W × H (in)
            <span style={{ display: "flex", gap: 6 }}>
              {(["lengthIn", "widthIn", "heightIn"] as const).map((key) => (
                <input
                  key={key}
                  type="number"
                  min={0}
                  step="0.1"
                  aria-label={key.replace("In", "")}
                  value={p[key] || ""}
                  onChange={(e) => patch(i, { [key]: numIn(e.target.value) })}
                />
              ))}
            </span>
          </label>
          <label>
            Empty weight (oz)
            <span style={{ display: "flex", gap: 6 }}>
              <input
                type="number"
                min={0}
                step="0.1"
                value={p.emptyWeightOz || ""}
                onChange={(e) => patch(i, { emptyWeightOz: numIn(e.target.value) })}
              />
              <button type="button" onClick={() => onChange(presets.filter((_, idx) => idx !== i), allowanceOz)}>
                Remove
              </button>
            </span>
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange(
            [...presets, { id: newId("box"), name: "", lengthIn: 0, widthIn: 0, heightIn: 0, emptyWeightOz: 0 }],
            allowanceOz,
          )
        }
      >
        Add box preset
      </button>
      <label>
        Packaging allowance per parcel (oz) — tape, filler, inserts
        <input
          type="number"
          min={0}
          step="0.1"
          value={allowanceOz}
          onChange={(e) => onChange(presets, numIn(e.target.value))}
        />
      </label>
      <p className="note">A preset with no name is dropped when you save. Remember to click Save settings.</p>
    </div>
  );
}

function ProductEditor({
  product,
  categories,
  presets,
  onChange,
  onMove,
  onUpload,
}: {
  product: Product;
  categories: ShopCategory[];
  presets: PackagePreset[];
  onChange: (p: Product) => void;
  onMove: (dir: number) => void;
  onUpload: (file: File) => void;
}) {
  const media = orderedMedia(product);

  return (
    <div className="admin-product">
      <div className="row">
        <label>
          Name
          <input
            value={product.name}
            onChange={(e) =>
              onChange({
                ...product,
                name: e.target.value,
                slug: product.slug || safeSlug(e.target.value),
              })
            }
          />
        </label>
        <label>
          Slug
          <input value={product.slug} onChange={(e) => onChange({ ...product, slug: e.target.value })} />
        </label>
      </div>
      <div className="row-3">
        <label>
          Category
          <select
            value={product.category}
            onChange={(e) => onChange({ ...product, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            {!categories.some((c) => c.name === product.category) && product.category ? (
              <option value={product.category}>{product.category}</option>
            ) : null}
          </select>
        </label>
        <label>
          Type
          <select
            value={product.kind}
            onChange={(e) => {
              const next = e.target.value;
              onChange({
                ...product,
                kind: next === "digital" ? "digital" : next === "sign" ? "sign" : "physical",
              });
            }}
          >
            <option value="physical">Physical (ships)</option>
            <option value="digital">Digital (no shipping)</option>
            <option value="sign">Metal sign (ships)</option>
          </select>
        </label>
        <label>
          Price (USD)
          <MoneyInput
            cents={product.priceCents}
            onCents={(priceCents) => onChange({ ...product, priceCents })}
          />
        </label>
                <label>
          Price label (optional — overrides dollar price on cards, e.g. From $49/mo or Coming soon)
          <input
            value={product.priceLabel || ""}
            onChange={(e) => onChange({ ...product, priceLabel: e.target.value })}
            placeholder="Leave blank to show the USD price"
          />
        </label>
        <label>
          External link (optional — no cart; CTA opens this URL)
          <input
            value={product.externalUrl || ""}
            onChange={(e) => onChange({ ...product, externalUrl: e.target.value })}
            placeholder="https://… or /contact"
          />
        </label>
        {product.kind === "digital" ? null : (
          <label>
            Shipping for this item (USD, 0 = use the shop rate)
            <MoneyInput
              cents={product.shippingCents}
              onCents={(shippingCents) => onChange({ ...product, shippingCents })}
            />
          </label>
        )}
        {product.kind === "digital" ? null : <PackageFields product={product} presets={presets} onChange={onChange} />}
        <label>
          Visible on site
          <select
            value={product.visible ? "yes" : "no"}
            onChange={(e) => onChange({ ...product, visible: e.target.value === "yes" })}
          >
            <option value="yes">Visible</option>
            <option value="no">Hidden</option>
          </select>
        </label>
        <label>
          Order
          <div>
            <button type="button" onClick={() => onMove(-1)}>
              Up
            </button>
            <button type="button" onClick={() => onMove(1)}>
              Down
            </button>
          </div>
        </label>
      </div>
      <p className="muted">{formatUsd(product.priceCents)}</p>
      <label>
        Description
        <textarea value={product.description} onChange={(e) => onChange({ ...product, description: e.target.value })} />
      </label>
      <label>
        Variants (comma separated)
        <input
          value={product.variants.map((v) => v.name).join(", ")}
          onChange={(e) =>
            onChange({
              ...product,
              variants: e.target.value
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ id: safeSlug(name), name })),
            })
          }
        />
      </label>
      <label>
        Variant note
        <textarea value={product.variantNote} onChange={(e) => onChange({ ...product, variantNote: e.target.value })} />
      </label>
      {product.kind === "digital" ? (
        <label>
          Digital delivery note (shown on the product page)
          <textarea
            value={product.digitalNote}
            onChange={(e) => onChange({ ...product, digitalNote: e.target.value })}
            placeholder="Emailed after payment. File format, license, etc."
          />
        </label>
      ) : null}
      <MediaField
        urls={media}
        onChange={(next) => onChange({ ...product, media: next })}
        onUpload={async (file) => onUpload(file)}
      />
    </div>
  );
}

function OrderRow({
  order,
  onRead,
  onShipped,
}: {
  order: ShopOrder;
  onRead: () => void;
  onShipped: (fields: Partial<ShopOrder>) => void;
}) {
  const [carrier, setCarrier] = useState(order.trackingCarrier || "usps");
  const [tracking, setTracking] = useState(order.trackingNumber || "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteBad, setNoteBad] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelNote, setLabelNote] = useState("");
  const [labelBad, setLabelBad] = useState(false);
  const [quote, setQuote] = useState<{
    shipmentId: string;
    rateId: string;
    carrier: string;
    service: string;
    oldCents: number;
    newCents: number;
    sameService: boolean;
    reason: string;
  } | null>(null);

  const canBuyLabel = order.paymentStatus === "paid" && Boolean(order.rateId && order.rateShipmentId) && !order.labelUrl;

  async function generateLabel(confirm?: { shipmentId: string; rateId: string }) {
    setLabelBusy(true);
    setLabelNote("");
    setLabelBad(false);
    try {
      const res = await fetch("/api/master/order-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, confirm }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.needsConfirm && json.quote) {
        setQuote(json.quote);
        return;
      }
      if (!res.ok || !json.ok) {
        setLabelBad(true);
        setLabelNote(json.error || "Could not buy the label.");
        return;
      }
      setQuote(null);
      if (json.order) {
        onShipped(json.order);
        if (json.order.trackingNumber) setTracking(json.order.trackingNumber);
        if (json.order.trackingCarrier) setCarrier(json.order.trackingCarrier);
      }
      setLabelBad(Boolean(json.storageWarning));
      setLabelNote(
        json.storageWarning ||
          (json.already
            ? "This order already had a label — nothing new was bought."
            : "Label bought. Print it, then use “Mark shipped & email tracking” below when it goes out."),
      );
    } catch {
      setLabelBad(true);
      setLabelNote("Could not reach the server. Refresh before trying again.");
    } finally {
      setLabelBusy(false);
    }
  }

  async function markShipped() {
    if (!tracking.trim()) {
      setNoteBad(true);
      setNote("Enter the tracking number from the label first.");
      return;
    }
    setBusy(true);
    setNote("");
    const res = await fetch("/api/master/order-ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, carrier, trackingNumber: tracking.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNoteBad(true);
      setNote(json.error || "Could not save that.");
      return;
    }
    onShipped({
      trackingCarrier: carrier,
      trackingNumber: tracking.trim(),
      shippedAt: json.shippedAt || new Date().toISOString(),
      customerNotified: Boolean(json.notified),
    });
    setNoteBad(!json.notified);
    setNote(
      json.notified
        ? "Tracking saved and emailed to the customer."
        : json.error || "Tracking saved, but no email went out.",
    );
  }

  return (
    <div className="quote-item">
      <strong>{formatUsd(order.amountCents)}</strong> · {order.name || "Customer"} · {order.email || "no email"}
      {!order.read ? <span className="muted"> · new</span> : null}
      <p style={{ whiteSpace: "pre-wrap" }}>{order.items}</p>
      {order.address ? <p style={{ whiteSpace: "pre-wrap" }}>{order.address}</p> : null}
      {order.shippingLabel ? (
        <p className="muted">
          Paid for shipping: {order.shippingLabel} ({formatUsd(order.shippingCents)}) — buy this label
        </p>
      ) : null}
      <p className="muted">
        {order.sessionId.startsWith("cs_test_")
          ? "TEST checkout — no real card was charged. "
          : order.sessionId.startsWith("cs_live_")
            ? "Live payment. "
            : ""}
        {order.createdAt} · {order.emailed ? "email sent to the shop inbox" : "email failed — still saved here"}
      </p>

      {order.labelUrl ? (
        <p>
          <strong>Label:</strong> {order.labelCarrier} {order.labelService}
          {order.labelCents ? ` (${formatUsd(order.labelCents)})` : ""} · Tracking {order.trackingNumber || "—"} ·{" "}
          <a href={order.labelUrl} target="_blank" rel="noopener noreferrer">
            Open label PDF
          </a>
          {order.labelTrackingUrl ? (
            <>
              {" "}·{" "}
              <a href={order.labelTrackingUrl} target="_blank" rel="noopener noreferrer">
                Tracking page
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {canBuyLabel ? (
        <div>
          {quote ? (
            <div className="banner">
              <p>
                {quote.reason} New price: <strong>{formatUsd(quote.newCents)}</strong> for {quote.carrier}{" "}
                {quote.service} (customer paid {formatUsd(quote.oldCents)}
                {quote.newCents !== quote.oldCents
                  ? `, ${quote.newCents > quote.oldCents ? "+" : "−"}${formatUsd(Math.abs(quote.newCents - quote.oldCents))}`
                  : ", no change"}
                ).
                {!quote.sameService ? " The original service is not offered for this address — this is the closest match." : ""}
              </p>
              <button
                type="button"
                disabled={labelBusy}
                onClick={() => generateLabel({ shipmentId: quote.shipmentId, rateId: quote.rateId })}
              >
                {labelBusy ? "Buying…" : `Buy label at ${formatUsd(quote.newCents)}`}
              </button>{" "}
              <button type="button" disabled={labelBusy} onClick={() => setQuote(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" disabled={labelBusy} onClick={() => generateLabel()}>
              {labelBusy ? "Working…" : `Generate shipping label (${order.rateCarrier} ${order.rateService})`}
            </button>
          )}
          {order.labelStatus === "error" && order.labelError && !labelNote ? (
            <p className="err">Last try failed: {order.labelError}</p>
          ) : null}
        </div>
      ) : null}
      {labelNote ? <p className={labelBad ? "err" : "ok"}>{labelNote}</p> : null}

      {order.shippedAt ? (
        <p className="muted">
          Shipped {order.shippedAt} · {order.trackingCarrier || "carrier"} {order.trackingNumber} ·{" "}
          {order.customerNotified ? "customer emailed" : "customer NOT emailed"}
        </p>
      ) : null}

      <div>
        <label>
          Carrier
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            {CARRIERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tracking number
          <input
            value={tracking}
            placeholder="Paste it off the label"
            onChange={(e) => setTracking(e.target.value)}
          />
        </label>
        <button type="button" onClick={markShipped} disabled={busy}>
          {busy ? "Sending…" : order.shippedAt ? "Resend tracking" : "Mark shipped & email tracking"}
        </button>
      </div>
      {note ? <p className={noteBad ? "err" : "ok"}>{note}</p> : null}

      {!order.read ? (
        <button type="button" onClick={onRead}>
          Mark read
        </button>
      ) : null}
    </div>
  );
}

function QuoteRow({ quote, onRead }: { quote: Quote; onRead: () => void }) {
  return (
    <div className="quote-item">
      <strong>{quote.name}</strong> · {quote.email} · {quote.phone || "no phone"}
      {!quote.read ? <span className="muted"> · new</span> : null}
      <p style={{ whiteSpace: "pre-wrap" }}>{quote.need}</p>
      {quote.kind === "sign" ? (
        <p className="muted">
          Sign request
          {quote.widthIn || quote.heightIn ? ` · ${quote.widthIn} × ${quote.heightIn} in` : ""}
          {quote.finishName ? ` · ${quote.finishName}` : ""}
          {quote.fulfillment ? ` · ${quote.fulfillment}` : ""}
          {quote.estimateLabel ? ` · estimate ${quote.estimateLabel}` : ""}
        </p>
      ) : null}
      {quote.sampleUrl ? (
        <p>
          <a href={quote.sampleUrl} rel="noreferrer">
            Sample they picked
          </a>
        </p>
      ) : null}
      {quote.photoUrl ? (
        <p>
          <a href={quote.photoUrl} rel="noreferrer">
            Photo
          </a>
        </p>
      ) : null}
      <p className="muted">
        {quote.createdAt} · {quote.emailed ? "email sent" : "saved to inbox only"}
      </p>
      {!quote.read ? (
        <button type="button" onClick={onRead}>
          Mark read
        </button>
      ) : null}
    </div>
  );
}
