import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { familyCover, familyLead, productsInFamily } from "@/lib/families";
import { pageMeta, withBrand } from "@/lib/seo";
import { categorySlug, readStore, visibleProducts } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const path = `/shop/family/${encodeURIComponent(code)}`;
  try {
    const store = await readStore();
    const members = productsInFamily(visibleProducts(store), code);
    if (members.length >= 2) {
      const lead = familyLead(members);
      const name = lead.name.replace(/^Copy of\s+/i, "");
      return pageMeta({
        title: withBrand(`${name}, Sheridan, WY`),
        description: `${name} (item ${code}) in ${members.length} faces, made to order by Big Horn Custom Works in Sheridan, WY. Pick a face and a size, then ship or pick up.`,
        path,
        image: familyCover(members),
        imageAlt: name,
      });
    }
  } catch {
    /* fall through */
  }
  return pageMeta({
    title: `Item ${code} | Big Horn Custom Works, Sheridan, WY`,
    description: "Made-to-order items from Big Horn Custom Works in Sheridan, WY.",
    path,
  });
}

export default async function FamilyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const store = await readStore();
  const members = productsInFamily(visibleProducts(store), code);
  if (members.length < 2) notFound();
  const lead = familyLead(members);
  const title = lead.name.replace(/^Copy of\s+/i, "");
  const back =
    lead.kind === "sign" ? "/signs" : lead.kind === "digital" ? "/digital" : "/physical";
  const cat = categorySlug(lead.category);

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <Link className="back-link" href={back}>
          {lead.kind === "sign" ? "Signs" : "Physical"}
        </Link>
        {lead.kind === "sign" ? (
          <Link className="back-link" href={`/signs/${cat}`}>
            {lead.category}
          </Link>
        ) : null}
      </p>
      <p className="section-kicker">Item {code}</p>
      <h1>{title}</h1>
      <p className="lede">
        {members.length} faces. Pick the one you want. If one is out of ready stock it can still be ordered — Clint
        makes that face to order.
      </p>
      <div className="grid-catalog">
        {members.map((p) => (
          <ProductCard key={p.id} product={p} showOptions />
        ))}
      </div>
    </div>
  );
}
