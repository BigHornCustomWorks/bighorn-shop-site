import type { Metadata } from "next";
import Link from "next/link";
import { ServiceRequestForm } from "@/components/ServiceRequestForm";
import { readStore } from "@/lib/store";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const store = await readStore();
  return (
    <div className="wrap">
      <p className="section-kicker">Services</p>
      <h1>Custom fabrication in Sheridan, Wyoming</h1>
      <p className="lede">
        Need something that doesn&apos;t exist, or that is no longer manufactured? I&apos;ll make it. Metal, wood, and
        3D printed — designed and built under one roof.
      </p>
      <div className="hero-actions">
        <a className="btn btn-bronze" href="#request">
          Request a quote
        </a>
        <Link className="btn" href="/physical/mill-accessories">
          Shop mill parts
        </Link>
      </div>

      <div className="service-list">
        <article>
          <h2>Replacement parts</h2>
          <p>
            Send photos and measurements of the piece that failed. I can 3D print it, cut it on the mill or lathe, or
            weld a replacement.
          </p>
        </article>
        <article>
          <h2>Custom metal signs</h2>
          <p>
            Plasma-cut signs up to 24×32 inches. Same-day proof when possible. Larger signs are quoted in sections.
          </p>
        </article>
        <article>
          <h2>Mixed materials</h2>
          <p>Steel on wood, mounts, and brackets, designed and built as one job.</p>
        </article>
        <article>
          <h2>3D printing</h2>
          <p>Functional parts, printed here. Pricing is on request for now.</p>
        </article>
        <article>
          <h2>Mill catalog</h2>
          <p>Way covers, T-slot covers, and the spindle lock are already on the shop. This page does not add new items.</p>
          <p>
            <Link href="/physical/mill-accessories">Shop mill parts</Link>
          </p>
        </article>
      </div>

      <section id="request">
        <h2>Request a quote</h2>
        <p className="note">Goes to {store.site.contactEmail} and Master Control.</p>
        <ServiceRequestForm />
      </section>
    </div>
  );
}
