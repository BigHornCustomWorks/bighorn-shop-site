"use client";

import { useRef, useState } from "react";
import { MoneyInput } from "./MoneyInput";
import { compressImage } from "@/lib/compressImage";
import { formatUsd } from "@/lib/money";
import { newId } from "@/lib/sanitize";
import { MIN_DESIGN_PRICE_CENTS, saleSizes, sizeLabel } from "@/lib/sign-designs";
import { fileUploadKind, isVideoSrc } from "@/lib/video";
import { maxForKind } from "@/lib/uploadLimits";
import type { ShopStore, SignDesign, SignDesignSize } from "@/lib/types";

const MAX_DESIGNS = 40;
const MAX_SIZES = 8;

function blankSize(): SignDesignSize {
  return { id: newId("size"), label: "", widthIn: 0, heightIn: 0, priceCents: 0 };
}

function blankDesign(image = ""): SignDesign {
  return { id: newId("design"), name: "", image, sizes: [blankSize()] };
}

export function SignSamplesPanel({
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
  const photos = (signs.media || []).filter((src) => src && !isVideoSrc(src));
  const designs = signs.designs || [];
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");

  function patchDesigns(next: SignDesign[]) {
    setStore({ ...store, metalSigns: { ...signs, designs: next } });
  }

  function updateDesign(id: string, fields: Partial<SignDesign>) {
    patchDesigns(designs.map((design) => (design.id === id ? { ...design, ...fields } : design)));
  }

  function updateSize(designId: string, sizeId: string, fields: Partial<SignDesignSize>) {
    patchDesigns(
      designs.map((design) =>
        design.id === designId
          ? { ...design, sizes: design.sizes.map((size) => (size.id === sizeId ? { ...size, ...fields } : size)) }
          : design,
      ),
    );
  }

  async function onUpload(file: File): Promise<string> {
    const kind = fileUploadKind(file);
    if (kind !== "photo") {
      setNote("Use a photo. Video stays with the quote samples.");
      return "";
    }
    const toSend = await compressImage(file);
    if (toSend.size > maxForKind(kind)) {
      setNote("That photo is too large.");
      return "";
    }
    setUploading(true);
    setNote("");
    try {
      return (await uploadFile(toSend, kind)) || "";
    } finally {
      setUploading(false);
    }
  }

  async function addPhoto(file: File | undefined) {
    if (!file || designs.length >= MAX_DESIGNS) return;
    const url = await onUpload(file);
    if (!url) return;
    const design = blankDesign(url);
    patchDesigns([...designs, design]);
    window.setTimeout(() => document.getElementById(`sell-${design.id}`)?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function sellPhoto(src: string) {
    const existing = designs.find((design) => design.image === src);
    if (existing) {
      document.getElementById(`sell-${existing.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (designs.length >= MAX_DESIGNS) return;
    const design = blankDesign(src);
    patchDesigns([...designs, design]);
    window.setTimeout(() => document.getElementById(`sell-${design.id}`)?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div>
      <div className="card" style={{ padding: 16 }}>
        <p className="section-kicker">Live site</p>
        <h2>I want this samples</h2>
        <p className="note">
          These pictures have the “I want this” button on the Signs page. That button starts a custom request. Sell
          this picture to price a size below, or add a new photo. Quote-only photos are still added under Custom size
          &amp; rate.
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
                <button type="button" className="btn" onClick={() => sellPhoto(src)}>
                  {designs.some((design) => design.image === src) ? "Already listed below" : "Sell this picture"}
                </button>
              </figure>
            ))}
          </div>
        ) : (
          <p className="muted">No quote photos yet. Add them under Custom size &amp; rate.</p>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <p className="section-kicker">Customer page</p>
        <h2>Sign designs ready for sale</h2>
        <p className="note">
          Add the artwork, the name, and each size you will cut. Type the price yourself. A size stays off the shop
          until it has a width, a height, and a price of at least {formatUsd(MIN_DESIGN_PRICE_CENTS)}. Customers pay
          that price plus shipping, or pick up in Sheridan for free. Save designs when you are done.
        </p>
        <div className="hero-actions">
          <PhotoButton
            label={uploading ? "Uploading…" : "Add a design photo"}
            className="btn btn-bronze"
            disabled={uploading || designs.length >= MAX_DESIGNS}
            onFile={(file) => void addPhoto(file)}
          />
          <button className="btn btn-bronze" type="button" onClick={() => save(store)}>
            Save designs
          </button>
        </div>
        {note ? <p className="note">{note}</p> : null}

        {designs.length ? (
          designs.map((design) => (
            <DesignEditor
              key={design.id}
              design={design}
              onDesign={(fields) => updateDesign(design.id, fields)}
              onSize={(sizeId, fields) => updateSize(design.id, sizeId, fields)}
              onAddSize={() => {
                if (design.sizes.length >= MAX_SIZES) return;
                updateDesign(design.id, { sizes: [...design.sizes, blankSize()] });
              }}
              onRemoveSize={(sizeId) => {
                const sizes = design.sizes.filter((size) => size.id !== sizeId);
                updateDesign(design.id, { sizes: sizes.length ? sizes : [blankSize()] });
              }}
              onRemove={() => {
                if (!window.confirm("Remove this design from the shop?")) return;
                patchDesigns(designs.filter((item) => item.id !== design.id));
              }}
              onReplace={async (file) => {
                const url = await onUpload(file);
                if (url) updateDesign(design.id, { image: url });
              }}
            />
          ))
        ) : (
          <p className="muted">No designs for sale yet. Add a photo, set the sizes and prices, then Save designs.</p>
        )}

        <div className="hero-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-bronze" type="button" onClick={() => save(store)}>
            Save designs
          </button>
        </div>
      </div>
    </div>
  );
}

function DesignEditor({
  design,
  onDesign,
  onSize,
  onAddSize,
  onRemoveSize,
  onRemove,
  onReplace,
}: {
  design: SignDesign;
  onDesign: (fields: Partial<SignDesign>) => void;
  onSize: (sizeId: string, fields: Partial<SignDesignSize>) => void;
  onAddSize: () => void;
  onRemoveSize: (sizeId: string) => void;
  onRemove: () => void;
  onReplace: (file: File) => Promise<void>;
}) {
  const ready = saleSizes(design);
  return (
    <article className="mc-design" id={`sell-${design.id}`}>
      <div>
        {design.image ? (
          <img src={design.image} alt={design.name || "Sign design"} />
        ) : (
          <p className="muted">No photo yet.</p>
        )}
        <PhotoButton label="Replace photo" className="btn" onFile={(file) => void onReplace(file)} />
      </div>
      <div>
        <label>
          Name on the shop
          <input value={design.name} onChange={(e) => onDesign({ name: e.target.value })} />
        </label>
        <p className="muted">
          {ready.length
            ? `On the shop in ${ready.length} size${ready.length === 1 ? "" : "s"}.`
            : "Not on the shop yet. Add a width, a height, and a price."}
        </p>
        {design.sizes.map((size) => (
          <div className="mc-design-size" key={size.id}>
            <label>
              Label (optional)
              <input value={size.label} onChange={(e) => onSize(size.id, { label: e.target.value })} />
            </label>
            <div className="mc-design-pair">
              <label>
                Width (in)
                <InchField value={size.widthIn} onChange={(widthIn) => onSize(size.id, { widthIn })} />
              </label>
              <label>
                Height (in)
                <InchField value={size.heightIn} onChange={(heightIn) => onSize(size.id, { heightIn })} />
              </label>
            </div>
            <label>
              Price
              <MoneyInput cents={size.priceCents} onCents={(priceCents) => onSize(size.id, { priceCents })} />
            </label>
            <button type="button" className="btn-ghost" onClick={() => onRemoveSize(size.id)}>
              Remove size
            </button>
          </div>
        ))}
        {design.sizes.some((size) => size.priceCents > 0 && size.priceCents < MIN_DESIGN_PRICE_CENTS) ? (
          <p className="note">A price under {formatUsd(MIN_DESIGN_PRICE_CENTS)} cannot be checked out.</p>
        ) : null}
        {ready.map((size) => (
          <p key={size.id} className="muted">
            Customers pay {formatUsd(size.priceCents)} for {sizeLabel(size)}, plus shipping or free pickup.
          </p>
        ))}
        <div className="hero-actions">
          {design.sizes.length < MAX_SIZES ? (
            <button type="button" className="btn" onClick={onAddSize}>
              Add a size
            </button>
          ) : null}
          <button type="button" className="btn-danger" onClick={onRemove}>
            Remove design
          </button>
        </div>
      </div>
    </article>
  );
}

function PhotoButton({
  label,
  className,
  disabled,
  onFile,
}: {
  label: string;
  className: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => ref.current?.click()}>
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

function InchField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  const [editing, setEditing] = useState(false);
  const shown = editing ? text : value ? String(value) : "";
  return (
    <input
      inputMode="decimal"
      value={shown}
      onFocus={() => {
        setText(value ? String(value) : "");
        setEditing(true);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0);
      }}
      onBlur={() => setEditing(false)}
    />
  );
}
