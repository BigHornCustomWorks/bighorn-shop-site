import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { familyCover, familyLead, type ShelfEntry } from "@/lib/families";
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
  const photo = familyCover(members);
  const title = lead.name.replace(/^Copy of\s+/i, "");
  return (
    <Link className="product-card" href={`/shop/family/${stem}`}>
      <div className="product-card-media">
        <img src={photo} alt="" />
      </div>
      <div className="pad">
        <p className="card-meta">Item {stem}</p>
        <h3>{title}</h3>
        <p className="muted card-blurb">{members.length} faces — click to choose a face and a size</p>
        <div className="face-thumbs">
          {members.slice(0, 4).map((member) => (
            <img key={member.id} src={firstPhoto(member) || "/logo.png"} alt={member.sku} />
          ))}
        </div>
      </div>
    </Link>
  );
}
