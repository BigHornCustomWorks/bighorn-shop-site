"use client";

import { useEffect, useState } from "react";
import { dollarsToCents, formatUsd } from "@/lib/money";
import { newId, safeSlug } from "@/lib/sanitize";
import type { Product, Quote, ShopStore } from "@/lib/types";

type Tab = "products" | "copy" | "quotes" | "settings";

const emptyProduct = (): Product => ({
  id: newId("prod"),
  slug: "",
  name: "",
  priceCents: 0,
  description: "",
  photos: [],
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

  async function uploadTo(productId: string, file: File) {
    const data = new FormData();
    data.set("file", file);
    const res = await fetch("/api/master/upload", { method: "POST", body: data });
    const json = await res.json();
    if (!res.ok || !json.url || !store) {
      setError(json.error || "Upload failed. Paste a URL instead.");
      return;
    }
    const products = store.products.map((p) =>
      p.id === productId ? { ...p, photos: [...p.photos, json.url] } : p,
    );
    await save({ ...store, products });
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
        <div>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const p = emptyProduct();
              p.sortOrder = store.products.length + 1;
              setStore({ ...store, products: [...store.products, p] });
            }}
          >
            Add product
          </button>
          {store.products.map((product, index) => (
            <ProductEditor
              key={product.id}
              product={product}
              onChange={(next) => {
                const products = [...store.products];
                products[index] = next;
                setStore({ ...store, products });
              }}
              onMove={(dir) => {
                const products = [...store.products];
                const j = index + dir;
                if (j < 0 || j >= products.length) return;
                [products[index], products[j]] = [products[j], products[index]];
                setStore({
                  ...store,
                  products: products.map((p, i) => ({ ...p, sortOrder: i + 1 })),
                });
              }}
              onUpload={(file) => uploadTo(product.id, file)}
            />
          ))}
          <button className="btn btn-bronze" type="button" onClick={() => save(store)}>
            Save products
          </button>
        </div>
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
            Hero photo URL
            <input value={store.site.heroUrl} onChange={(e) => setStore({ ...store, site: { ...store.site, heroUrl: e.target.value } })} />
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
            Quote email via Resend: {envResend ? "configured" : "not set — quotes still land in this inbox"}.
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

function ProductEditor({
  product,
  onChange,
  onMove,
  onUpload,
}: {
  product: Product;
  onChange: (p: Product) => void;
  onMove: (dir: number) => void;
  onUpload: (file: File) => void;
}) {
  const [photoUrl, setPhotoUrl] = useState("");
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
          Or upload
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!photoUrl.trim()) return;
          onChange({ ...product, photos: [...product.photos, photoUrl.trim()] });
          setPhotoUrl("");
        }}
      >
        Add URL
      </button>
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
