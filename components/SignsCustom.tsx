"use client";

import { useState } from "react";
import { SignRequestForm } from "./SignRequestForm";
import { SignSampleGrid } from "./SignSampleGrid";
import type { MetalSignsConfig } from "@/lib/types";

export function SignsCustom({
  config,
  pickupEnabled,
  pickupLabel,
}: {
  config: MetalSignsConfig;
  pickupEnabled: boolean;
  pickupLabel: string;
}) {
  const [sample, setSample] = useState("");

  function want(src: string) {
    setSample(src);
    const el = document.getElementById("sign-request");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section style={{ marginTop: 28 }}>
        <p className="section-kicker">Samples</p>
        <h2>I want this</h2>
        <p className="muted">Pick a sample, then enter the size you want on the request form.</p>
        <SignSampleGrid media={config.media || []} selected={sample} onWant={want} />
      </section>

      <section style={{ marginTop: 36 }}>
        <p className="section-kicker">Custom sign</p>
        <h2>Request a custom sign</h2>
        <p className="muted">
          Describe it, pick a size and finish. You get an estimate from the size. Local pickup has no shipping charge.
        </p>
        <SignRequestForm
          config={config}
          pickupEnabled={pickupEnabled}
          pickupLabel={pickupLabel}
          sampleUrl={sample}
          onClearSample={() => setSample("")}
        />
      </section>
    </>
  );
}
