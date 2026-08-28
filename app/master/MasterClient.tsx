"use client";

import { useEffect, useState } from "react";
import { dollarsToCents, formatUsd } from "@/lib/money";
import { newId, safeSlug } from "@/lib/sanitize";
import type { Product, Quote, ShopCategory, ShopStore } from "@/lib/types";

type Tab = "products" | "copy" | "quotes" | "settings";

const emptyProduct = (): Product => ({
  id: newId("prod"),
  slug: "",
  name: "",
  priceCents: 0,
  description: "",
  photos: [],
  videos: [],
  category: "Mill accessories",
  kind: "physical",
  digitalNote: "",
  variants: [],
  variantNote: "",
  visible: true,
  sortOrder: 99,
});

export function MasterClient() {
  const [tab, setTab] = useState<Tab>("products");
  const [store, setStore] = useState<ShopStore | null>(null);
  const [persistence, setPersistence] = useState("");
  const [envStripe, setEnvStripe] = useState(false);
  const [envResend, setEnvResend] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [stripeKeyDraft, setStripeKeyDraft] = useState("");
  const [envSmtp, setEnvSmtp] = useState(false);
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
        setEnvStripe(Boolean(json.envStripe));
        setEnvResend(Boolean(json.envResend));
        setEnvSmtp(Boolean(json.envSmtp));
      })
      .catch(() => setError("Could not load Master Control."));
  }, []);

  async function save(next: ShopStore, extra?: { stripeSecretKey?: string }) {
    setStatus("Saving…");
    setError("");
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
    setStore(next);
    setPersistence(json.persistence || json.persisted || persistence);
    setStatus(`Saved (${json.persisted || "ok"}). Shop page reads this without a deploy.`);
  }

  async function uploadTo(productId: string, file: File, kind: "photo" | "video" = "photo") {
    const data = new FormData();
    data.set("file", file);
    data.set("kind", kind);
    const res = await fetch("/api/master/upload", { method: "POST", body: data });
    const json = await res.json();
    if (!res.ok || !json.url || !store) {
      setError(json.error || "Upload failed. Paste a URL instead.");
      return;
    }
    const products = store.products.map((p) => {
      if (p.id !== productId) return p;
      if (kind === "video") return { ...p, videos: [...(p.videos || []), json.url] };
      return { ...p, photos: [...p.photos, json.url] };
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

  const unread = store.quotes.filter((q) => !q.read).length;

  return (
    <div className="master">
      <h1>Master Control</h1>
      <p className="note">
        Edit copy, products, photos, prices, and links. Public pages only render cleaned text — messy HTML/JS will not
        crash the shop.
      </p>
      <p className="note">Storage: {persistence}</p>
      <div className="tabs">
        {(
          [
            ["products", "Products"],
            ["copy", "Site copy"],
            ["quotes", `Quotes${unread ? ` (${unread})` : ""}`],
            ["settings", "Settings"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} type="button" onClick={() => setTab(id)}>
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

      {tab === "products" ? (
        <ProductsTab
          store={store}
          setStore={setStore}
          save={save}
          uploadTo={uploadTo}
          query={query}
          setQuery={setQuery}
          filterCat={filterCat}
          setFilterCat={setFilterCat}
          openId={openId}
          setOpenId={setOpenId}
          newCat={newCat}
          setNewCat={setNewCat}
          dragCat={dragCat}
          setDragCat={setDragCat}
          dragProd={dragProd}
          setDragProd={setDragProd}
        />
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
          <label>
            Flat shipping (cents, 0 = none — do not invent rates)
            <input
              type="number"
              min={0}
              value={store.site.shippingCents}
              onChange={(e) => setStore({ ...store, site: { ...store.site, shippingCents: Number(e.target.value) || 0 } })}
            />
          </label>
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

      {tab === "settings" ? (
        <div className="form" style={{ maxWidth: 760 }}>
          <div className="banner">{store.site.shopFloorNotes}</div>
          <label>
            Shop-floor notes (only you see these)
            <textarea value={store.site.shopFloorNotes} onChange={(e) => setStore({ ...store, site: { ...store.site, shopFloorNotes: e.target.value } })} />
          </label>
          <p>
            Visitors: {(store.stats?.uniqueVisitors || 0).toLocaleString("en-US")} unique ·{" "}
            {(store.stats?.pageViews || 0).toLocaleString("en-US")} page views
          </p>
          <p>Stripe env key: {envStripe ? "set" : "missing"} · Mode: {store.settings.stripeMode}</p>
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
  store: ShopStore;
  setStore: (s: ShopStore) => void;
  save: (s: ShopStore) => Promise<void>;
  uploadTo: (id: string, file: File, kind: "photo" | "video") => Promise<void>;
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
    if (filterCat !== "all" && p.category !== filterCat) return false;
    if (!q) return true;
    return `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q);
  });
  const open = store.products.find((p) => p.id === openId);

  function reorderCats(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...categories];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setStore({ ...store, categories: next.map((c, i) => ({ ...c, sortOrder: i + 1 })) });
  }

  function reorderProds(fromId: string, toId: string) {
    if (fromId === toId) return;
    const next = [...store.products];
    const from = next.findIndex((p) => p.id === fromId);
    const to = next.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setStore({ ...store, products: next.map((p, i) => ({ ...p, sortOrder: i + 1 })) });
  }

  return (
    <div>
      <p className="note">
        Categories you add here show on the shop once they have a visible product. Drag a chip or a card to reorder.
      </p>
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
            const p = emptyProduct();
            p.sortOrder = store.products.length + 1;
            if (filterCat !== "all") p.category = filterCat;
            else if (categories[0]) p.category = categories[0].name;
            setStore({ ...store, products: [...store.products, p] });
            setOpenId(p.id);
          }}
        >
          Add product
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
            <img src={product.photos[0] || "/logo.png"} alt="" />
            <div className="pad">
              <p className="card-meta">
                {product.category}
                {product.kind === "digital" ? " · Digital" : ""}
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
          onUpload={(file, kind) => uploadTo(open.id, file, kind)}
        />
      ) : (
        <p className="note">Click a card to edit. Drag cards to reorder. Save when you are done.</p>
      )}
    </div>
  );
}

function ProductEditor({
  product,
  categories,
  onChange,
  onMove,
  onUpload,
}: {
  product: Product;
  categories: ShopCategory[];
  onChange: (p: Product) => void;
  onMove: (dir: number) => void;
  onUpload: (file: File, kind: "photo" | "video") => void;
}) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const dollars = (product.priceCents / 100).toFixed(2);

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
            onChange={(e) =>
              onChange({
                ...product,
                kind: e.target.value === "digital" ? "digital" : "physical",
              })
            }
          >
            <option value="physical">Physical (ships)</option>
            <option value="digital">Digital (no shipping)</option>
          </select>
        </label>
        <label>
          Price (USD)
          <input
            value={dollars}
            onChange={(e) => onChange({ ...product, priceCents: dollarsToCents(e.target.value) })}
          />
        </label>
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
      <p className="note">Photos</p>
      <div className="thumbs">
        {product.photos.map((url) => (
          <button
            key={url}
            type="button"
            title="Remove"
            onClick={() => onChange({ ...product, photos: product.photos.filter((p) => p !== url) })}
          >
            <img src={url} alt="" />
          </button>
        ))}
      </div>
      <div className="row">
        <label>
          Add photo URL
          <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
        </label>
        <label>
          Choose photo
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      <div className="hero-actions">
        <button
          type="button"
          className="btn"
          disabled={!photoFile}
          onClick={() => {
            if (!photoFile) return;
            onUpload(photoFile, "photo");
            setPhotoFile(null);
          }}
        >
          {photoFile ? `Upload photo (${photoFile.name})` : "Upload photo"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!photoUrl.trim()) return;
            onChange({ ...product, photos: [...product.photos, photoUrl.trim()] });
            setPhotoUrl("");
          }}
        >
          Add photo URL
        </button>
      </div>
      <p className="note">Demo videos (YouTube, Vimeo, or a direct .mp4 / .webm link)</p>
      {(product.videos || []).map((url) => (
        <p key={url} className="muted">
          {url}{" "}
          <button type="button" onClick={() => onChange({ ...product, videos: product.videos.filter((v) => v !== url) })}>
            Remove
          </button>
        </p>
      ))}
      <label>
        Choose video file
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
        />
      </label>
      <div className="hero-actions">
        <button
          type="button"
          className="btn"
          disabled={!videoFile}
          onClick={() => {
            if (!videoFile) return;
            onUpload(videoFile, "video");
            setVideoFile(null);
          }}
        >
          {videoFile ? `Upload video (${videoFile.name})` : "Upload video"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!videoUrl.trim()) return;
            onChange({ ...product, videos: [...(product.videos || []), videoUrl.trim()] });
            setVideoUrl("");
          }}
        >
          Add video URL
        </button>
      </div>
      <label>
        Or paste YouTube / Vimeo / mp4 URL
        <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
      </label>
    </div>
  );
}

function QuoteRow({ quote, onRead }: { quote: Quote; onRead: () => void }) {
  return (
    <div className="quote-item">
      <strong>{quote.name}</strong> · {quote.email} · {quote.phone || "no phone"}
      {!quote.read ? <span className="muted"> · new</span> : null}
      <p style={{ whiteSpace: "pre-wrap" }}>{quote.need}</p>
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
