import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { familyLead, productsInFamily } from "@/lib/families";
import { readStore, visibleProducts } from "@/lib/store";

export default async function FamilyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const store = await readStore();
  const members = productsInFamily(visibleProducts(store), code);
  if (members.length < 2) notFound();
  const lead = familyLead(members);
  const title = lead.name.replace(/^Copy of\s+/i, "");
  const back =
    lead.kind === "sign" ? "/signs" : lead.kind === "digital" ? "/digital" : "/physical";

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <Link className="back-link" href={back}>
          {lead.kind === "sign" ? "Signs" : "Physical"}
        </Link>
      </p>
      <p className="section-kicker">Item {code}</p>
      <h1>{title}</h1>
      <p className="lede">
        {members.length} faces. Pick the one you want. If one is out of ready stock it can still be ordered — Clint
        makes that face to order.
      </p>
      <div className="grid-catalog">
        {members.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
