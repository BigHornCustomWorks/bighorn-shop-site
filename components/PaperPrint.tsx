"use client";

import { useState } from "react";
import { orderFulfillment } from "@/lib/order-history";
import type { ShopOrder } from "@/lib/types";

export function PaperPrint({ order }: { order: ShopOrder }) {
  const [blocked, setBlocked] = useState(false);
  const mailing = orderFulfillment(order) === "ship";

  function open(kind: "receipt" | "slip" | "both") {
    const tab = window.open(
      `/api/master/order-paper?orderId=${encodeURIComponent(order.id)}&kind=${kind}`,
      "_blank",
      "noopener,noreferrer",
    );
    setBlocked(!tab);
  }

  return (
    <div className="mc-label">
      <p className="mc-sale-kicker">Paper</p>
      <div className="hero-actions">
        {mailing ? (
          <button type="button" className="btn btn-bronze" onClick={() => open("both")}>
            Print receipt and packing slip
          </button>
        ) : null}
        <button type="button" className="btn" onClick={() => open("receipt")}>
          Print receipt
        </button>
        {mailing ? (
          <button type="button" className="btn" onClick={() => open("slip")}>
            Print packing slip
          </button>
        ) : null}
      </div>
      <p className="note">
        {mailing
          ? "Opens a letter-size page. The packing slip lists the address and the items. The receipt lists what they paid."
          : "Opens a letter-size receipt."}
      </p>
      {blocked ? <p className="err">The print page was blocked. Allow pop-ups for this site, then try again.</p> : null}
    </div>
  );
}
