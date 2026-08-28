import { QuoteForm } from "@/components/QuoteForm";
import { readStore } from "@/lib/store";

export default async function CustomPage() {
  const store = await readStore();
  return (
    <div className="wrap">
      <p className="section-kicker">Custom / quote</p>
      <h1>One-offs, not the catalog</h1>
      <p className="lede">
        Name the problem. If it needs to be designed, printed, welded, or rebuilt, this is the form.
        Catalog mill upgrades are on the shop page — this inbox is for work that does not have a SKU yet.
      </p>
      <p className="note">Goes to {store.site.contactEmail} and Master Control.</p>
      <QuoteForm />
    </div>
  );
}
