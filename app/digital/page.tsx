import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { digitalSection } from "@/lib/digital-sections";
import { readStore, visibleProducts } from "@/lib/store";
import type { Product } from "@/lib/types";

function DigitalGroup({
  kicker,
  title,
  lede,
  products,
  empty,
}: {
  kicker: string;
  title: string;
  lede: string;
  products: Product[];
  empty: string;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <p className="section-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p className="lede">{lede}</p>
      {products.length ? (
        <div className="grid-catalog">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

export default async function DigitalPage() {
  const store = await readStore();
  const products = visibleProducts(store).filter(
    (p) => p.kind === "digital" || (p.kind !== "sign" && /digital/i.test(p.category)),
  );
  const software = products.filter((p) => digitalSection(p) === "software");
  const files = products.filter((p) => digitalSection(p) === "files");

  return (
    <div className="wrap">
      <p className="back-row">
        <Link className="back-link" href="/">
          ← Home
        </Link>
      </p>
      <p className="section-kicker">Digital products</p>
      <h1>Software and files</h1>
      <p className="lede">
        Programs are in one section. STL files and other downloads are in the other. Repair Status is not sold in this
        shop.
      </p>
      <DigitalGroup
        kicker="Programs"
        title="Software"
        lede="Shop software. Repair Status opens on its own site. Other programs listed here stay on this shop."
        products={software}
        empty="No software is listed yet."
      />
      <DigitalGroup
        kicker="Downloads"
        title="Digital files"
        lede="STL files and other downloads. Nothing ships. When a file link is saved on the product, it is emailed after payment."
        products={files}
        empty="No STL or other file downloads are listed yet."
      />
      <p style={{ marginTop: 24 }}>
        <Link className="btn" href="/physical">
          Browse physical products
        </Link>
      </p>
    </div>
  );
}
