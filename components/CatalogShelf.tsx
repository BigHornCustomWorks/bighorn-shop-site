import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { familyLead, type ShelfEntry } from "@/lib/families";
import { firstPhoto } from "@/lib/video";

export function CatalogShelf({ entries }: { entries: ShelfEntry[] }) {
  if (!entries.length) return <p>Nothing in this line right now.</p>;
  return (
    <div className="grid-catalog">
      {entries.map((entry) =>
        entry.kind === "one" ? (
          <ProductCard key={entry.product.id} product={entry.product} />
        ) : (
          <FamilyCard key={entry.stem} stem={entry.stem} members={entry.members} />
        ),
      )}
    </div>
  );
}

function FamilyCard({ stem, members }: { stem: string; members: Product[] }) {
  const lead = familyLead(members);
  const photo = firstPhoto(lead) || "/logo.png";
  const title = lead.name.replace(/^Copy of\s+/i, "");
  return (
    <Link className="product-card" href={`/shop/family/${stem}`}>
      <div className="product-card-media">
        <img src={photo} alt="" />
      </div>
      <div className="pad">
        <p className="card-meta">Item {stem} · {members.length} faces</p>
        <h3>{title}</h3>
        <p className="muted card-blurb">Pick a face on the next page.</p>
      </div>
    </Link>
  );
}
