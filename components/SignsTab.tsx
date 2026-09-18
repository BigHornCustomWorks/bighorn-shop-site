"use client";

import { useMemo, useState } from "react";
import { MediaField } from "./MediaField";
import { MoneyInput } from "./MoneyInput";
import { compressImage } from "@/lib/compressImage";
import { formatUsd } from "@/lib/money";
import { estimateSign, inchLabel, unitLabel } from "@/lib/sign-price";
import { fileUploadKind } from "@/lib/video";
import { maxForKind } from "@/lib/uploadLimits";
import type { MetalSignsConfig, ShopStore } from "@/lib/types";

export function SignsTab({
  store,
  setStore,
  save,
  uploadFile,
}: {
  store: ShopStore;
  setStore: (s: ShopStore) => void;
  save: (s: ShopStore) => Promise<void>;
  uploadFile: (file: File, kind: string) => Promise<string>;
}) {
  const signs = store.metalSigns;
  const [width, setWidth] = useState("12");
  const [height, setHeight] = useState("12");
  const [uploading, setUploading] = useState(false);
  const quote = useMemo(() => estimateSign(signs, width, height), [signs, width, height]);
  const unit = unitLabel(signs.unit);

  function patch(fields: Partial<MetalSignsConfig>) {
    setStore({ ...store, metalSigns: { ...signs, ...fields } });
  }

  async function onUpload(file: File) {
    const kind = fileUploadKind(file);
    const toSend = kind === "video" ? file : await compressImage(file);
    const max = maxForKind(kind);
    if (toSend.size > max) {
      return;
    }
    setUploading(true);
    try {
      return (await uploadFile(toSend, kind)) || undefined;
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mc-signs">
      <div className="mc-section-head">
        <p className="section-kicker">Metal signs</p>
        <h2>Rate, photos, and the public estimator</h2>
        <p className="note">
          This is the door customers use on /signs. Set a cost per square foot or square inch. They enter a size, see
          the price, and pay that amount on Stripe. The server recalculates — they cannot send their own total.
        </p>
      </div>

      <div className="sign-estimator">
        <div className="card" style={{ padding: 16 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={signs.visible}
              onChange={(e) => patch({ visible: e.target.checked })}
            />
            Show the Signs page
          </label>
          <label>
            Heading
            <input value={signs.heading} onChange={(e) => patch({ heading: e.target.value })} />
          </label>
          <label>
            Intro
            <textarea value={signs.lede} onChange={(e) => patch({ lede: e.target.value })} />
          </label>
          <label>
            What’s included / caveats
            <textarea value={signs.note} onChange={(e) => patch({ note: e.target.value })} />
          </label>
          <div className="row">
            <label>
              Charge by
              <select
                value={signs.unit}
                onChange={(e) => patch({ unit: e.target.value === "sqin" ? "sqin" : "sqft" })}
              >
                <option value="sqft">Square foot</option>
                <option value="sqin">Square inch</option>
              </select>
            </label>
            <label>
              Rate ({formatUsd(signs.rateCents)} / {unit})
              <MoneyInput cents={signs.rateCents} onCents={(rateCents) => patch({ rateCents })} />
            </label>
          </div>
          <div className="row">
            <label>
              Minimum charge (0 = none)
              <MoneyInput cents={signs.minCents} onCents={(minCents) => patch({ minCents })} />
            </label>
            <label>
              Shipping for a sign (0 = shop rate)
              <MoneyInput
                cents={signs.shippingCents}
                onCents={(shippingCents) => patch({ shippingCents })}
              />
            </label>
          </div>
          <div className="row-3">
            <label>
              Min width (in)
              <input
                inputMode="decimal"
                value={signs.minWidthIn}
                onChange={(e) => patch({ minWidthIn: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Min height (in)
              <input
                inputMode="decimal"
                value={signs.minHeightIn}
                onChange={(e) => patch({ minHeightIn: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              Max width (in)
              <input
                inputMode="decimal"
                value={signs.maxWidthIn}
                onChange={(e) => patch({ maxWidthIn: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <label>
            Max height (in)
            <input
              inputMode="decimal"
              value={signs.maxHeightIn}
              onChange={(e) => patch({ maxHeightIn: Number(e.target.value) || 0 })}
            />
          </label>
        </div>

        <div className="sign-price-box">
          <p className="section-kicker kicker-spark">Try it</p>
          <p className="note" style={{ color: "#d7c4a4" }}>
            Same math the public page uses.
          </p>
          <div className="row">
            <label>
              Width (in)
              <input value={width} onChange={(e) => setWidth(e.target.value)} />
            </label>
            <label>
              Height (in)
              <input value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
          </div>
          {quote.ok ? (
            <>
              <p className="price">{formatUsd(quote.cents)}</p>
              <p>
                {inchLabel(quote.widthIn)} × {inchLabel(quote.heightIn)} in · {quote.areaLabel}
              </p>
              <p>{quote.rateLabel}</p>
            </>
          ) : (
            <>
              <p className="price">—</p>
              <p>{quote.error}</p>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 16 }}>
        <p className="section-kicker">Photos &amp; videos</p>
        <h3>Shown on the Signs page</h3>
        <MediaField
          urls={signs.media}
          onChange={(media) => patch({ media })}
          onUpload={onUpload}
          busyLabel={uploading ? "Uploading…" : undefined}
        />
      </div>

      <div className="hero-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-bronze" type="button" onClick={() => save(store)}>
          Save metal signs
        </button>
      </div>
    </div>
  );
}
