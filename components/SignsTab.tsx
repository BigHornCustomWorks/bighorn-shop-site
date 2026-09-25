"use client";

import { useMemo, useState } from "react";
import { MediaField } from "./MediaField";
import { MoneyInput } from "./MoneyInput";
import { compressImage } from "@/lib/compressImage";
import { formatUsd } from "@/lib/money";
import { estimateSign, inchLabel, unitLabel } from "@/lib/sign-price";
import { newId } from "@/lib/sanitize";
import { fileUploadKind } from "@/lib/video";
import { maxForKind } from "@/lib/uploadLimits";
import { signMetalOz, signParcel } from "@/lib/shipping";
import type { MetalSignsConfig, ShopStore, SignPackConfig } from "@/lib/types";

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
          </div>
          <p className="section-kicker" style={{ marginTop: 8 }}>
            Shipping by size
          </p>
          <p className="note">
            Postage = base + (square feet × extra). A 12×12 is 1 sq ft; a 24×24 is 4 sq ft. Leave all at $0 to use the
            shop-wide rate. When live Shippo rates are switched on (Settings), the customer enters a ZIP and pays the
            real USPS/UPS price for the packed sign instead — these size-based amounts are then only the fallback.
          </p>
          <div className="row-3">
            <label>
              Base postage
              <MoneyInput
                cents={signs.shippingBaseCents}
                onCents={(shippingBaseCents) => patch({ shippingBaseCents })}
              />
            </label>
            <label>
              Extra per sq ft
              <MoneyInput
                cents={signs.shippingPerSqFtCents}
                onCents={(shippingPerSqFtCents) => patch({ shippingPerSqFtCents })}
              />
            </label>
            <label>
              Cap (0 = none)
              <MoneyInput
                cents={signs.shippingMaxCents}
                onCents={(shippingMaxCents) => patch({ shippingMaxCents })}
              />
            </label>
          </div>
          <SignPackEditor pack={signs.pack} onChange={(pack) => patch({ pack })} />
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
          <p className="section-kicker" style={{ marginTop: 8 }}>
            Finishes
          </p>
          <p className="note">
            Extra can be per square foot or a flat add-on. $0 extra still shows as a choice (no extra). Bare metal is
            usually $0.
          </p>
          {(signs.finishes || []).map((finish, i) => (
            <div key={finish.id} className="row-3" style={{ alignItems: "end" }}>
              <label>
                Name
                <input
                  value={finish.name}
                  onChange={(e) =>
                    patch({
                      finishes: signs.finishes.map((f, idx) =>
                        idx === i ? { ...f, name: e.target.value } : f,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Extra ({finish.extraKind === "flat" ? "flat" : "/ sq ft"})
                <MoneyInput
                  cents={finish.extraCents}
                  onCents={(extraCents) =>
                    patch({
                      finishes: signs.finishes.map((f, idx) => (idx === i ? { ...f, extraCents } : f)),
                    })
                  }
                />
              </label>
              <label>
                How extra is charged
                <select
                  value={finish.extraKind}
                  onChange={(e) =>
                    patch({
                      finishes: signs.finishes.map((f, idx) =>
                        idx === i ? { ...f, extraKind: e.target.value === "flat" ? "flat" : "per_sqft" } : f,
                      ),
                    })
                  }
                >
                  <option value="per_sqft">Per square foot</option>
                  <option value="flat">Flat add-on</option>
                </select>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={finish.visible}
                  onChange={(e) =>
                    patch({
                      finishes: signs.finishes.map((f, idx) =>
                        idx === i ? { ...f, visible: e.target.checked } : f,
                      ),
                    })
                  }
                />
                Show
              </label>
              <button
                type="button"
                onClick={() => patch({ finishes: signs.finishes.filter((_, idx) => idx !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              patch({
                finishes: [
                  ...(signs.finishes || []),
                  {
                    id: newId("finish"),
                    name: "",
                    extraCents: 0,
                    extraKind: "per_sqft",
                    note: "",
                    visible: true,
                  },
                ],
              })
            }
          >
            Add finish
          </button>
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
              <p className="price">{formatUsd(quote.totalCents)}</p>
              <p>
                {inchLabel(quote.widthIn)} × {inchLabel(quote.heightIn)} in · {quote.areaLabel}
              </p>
              <p>
                Sign {formatUsd(quote.cents)} · {quote.shippingLabel}
              </p>
              <p>{quote.rateLabel}</p>
              <PackPreview config={signs} widthIn={quote.widthIn} heightIn={quote.heightIn} />
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

function PackPreview({ config, widthIn, heightIn }: { config: MetalSignsConfig; widthIn: number; heightIn: number }) {
  const parcel = signParcel(config, widthIn, heightIn);
  if (!parcel) return null;
  const metalLb = signMetalOz(config.pack, widthIn, heightIn) / 16;
  return (
    <p className="muted">
      Live-rate parcel: {parcel.length} × {parcel.width} × {parcel.height} in, {(parcel.weight / 16).toFixed(2)} lb
      ({metalLb.toFixed(2)} lb of {config.pack.material} at {config.pack.thicknessIn} in).
    </p>
  );
}

/**
 * How a custom sign is weighed and packed for live carrier rates:
 * weight = width × height × thickness × density, in a flat pack of sign size
 * plus a margin, with a thin depth, plus cardboard and a packaging allowance.
 */
function SignPackEditor({ pack, onChange }: { pack: SignPackConfig; onChange: (p: SignPackConfig) => void }) {
  const [newThickness, setNewThickness] = useState("");
  const set = (fields: Partial<SignPackConfig>) => onChange({ ...pack, ...fields });
  const dec = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  return (
    <div>
      <p className="section-kicker" style={{ marginTop: 8 }}>
        Weight &amp; packing for live rates
      </p>
      <p className="note">
        Sign weight = width × height × thickness × density. It ships flat in cardboard: sign size plus the margin
        on every side, at the depth below.
      </p>
      <div className="row-3">
        <label>
          Material
          <select value={pack.material} onChange={(e) => set({ material: e.target.value === "aluminum" ? "aluminum" : "steel" })}>
            <option value="steel">Steel</option>
            <option value="aluminum">Aluminum</option>
          </select>
        </label>
        <label>
          Thickness (in)
          <select value={String(pack.thicknessIn)} onChange={(e) => set({ thicknessIn: dec(e.target.value) })}>
            {pack.thicknessOptionsIn.map((t) => (
              <option key={t} value={String(t)}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Add a thickness option (in)
          <span style={{ display: "flex", gap: 6 }}>
            <input inputMode="decimal" value={newThickness} placeholder="0.090" onChange={(e) => setNewThickness(e.target.value)} />
            <button
              type="button"
              onClick={() => {
                const t = dec(newThickness);
                if (t > 0 && t <= 2 && !pack.thicknessOptionsIn.includes(t)) {
                  set({ thicknessOptionsIn: [...pack.thicknessOptionsIn, t].sort((a, b) => a - b) });
                }
                setNewThickness("");
              }}
            >
              Add
            </button>
          </span>
        </label>
      </div>
      <p className="muted">
        Options:{" "}
        {pack.thicknessOptionsIn.map((t) => (
          <button
            key={t}
            type="button"
            className="btn-ghost"
            disabled={t === pack.thicknessIn || pack.thicknessOptionsIn.length <= 1}
            title={t === pack.thicknessIn ? "In use" : "Remove this option"}
            onClick={() => set({ thicknessOptionsIn: pack.thicknessOptionsIn.filter((x) => x !== t) })}
          >
            {t} ✕
          </button>
        ))}
      </p>
      <div className="row-3">
        <label>
          Steel density (lb / cu in)
          <input type="number" step="any" min={0} value={pack.steelDensityLbPerIn3} onChange={(e) => set({ steelDensityLbPerIn3: dec(e.target.value) })} />
        </label>
        <label>
          Aluminum density (lb / cu in)
          <input type="number" step="any" min={0} value={pack.aluminumDensityLbPerIn3} onChange={(e) => set({ aluminumDensityLbPerIn3: dec(e.target.value) })} />
        </label>
        <label>
          Margin around sign (in)
          <input type="number" step="any" min={0} value={pack.marginIn} onChange={(e) => set({ marginIn: dec(e.target.value) })} />
        </label>
        <label>
          Flat-pack depth (in)
          <input type="number" step="any" min={0} value={pack.depthIn} onChange={(e) => set({ depthIn: dec(e.target.value) })} />
        </label>
        <label>
          Cardboard weight (oz / sq ft, both faces counted)
          <input type="number" step="any" min={0} value={pack.cardboardOzPerSqFt} onChange={(e) => set({ cardboardOzPerSqFt: dec(e.target.value) })} />
        </label>
        <label>
          Packaging allowance (oz)
          <input type="number" step="any" min={0} value={pack.allowanceOz} onChange={(e) => set({ allowanceOz: dec(e.target.value) })} />
        </label>
      </div>
    </div>
  );
}
