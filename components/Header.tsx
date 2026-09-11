"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";
import type { SiteCopy } from "@/lib/types";

export function Header({ site }: { site: SiteCopy }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <img src={site.logoUrl || "/logo.png"} alt="" width={64} height={64} />
          <span>
            <span className="brand-name">{site.companyName}</span>
            <span className="brand-sub">{site.location}</span>
          </span>
        </Link>
        <button className="nav-toggle" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Menu
        </button>
        <nav className={open ? "nav open" : "nav"} onClick={() => setOpen(false)}>
          <Link href="/physical">Physical</Link>
          <Link href="/digital">Digital</Link>
          <Link href="/custom">Custom</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/cart">
            Cart{count > 0 ? <span className="cart-count">{count}</span> : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}
