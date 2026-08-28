import { QuoteForm } from "@/components/QuoteForm";
import { readStore } from "@/lib/store";
import { safeUrl } from "@/lib/sanitize";

export default async function ContactPage() {
  const { site } = await readStore();
  const li = safeUrl(site.linkedinUrl);
  return (
    <div className="wrap">
      <p className="section-kicker">Contact</p>
      <h1>Talk to the shop</h1>
      <p>
        Email: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
      </p>
      <p>{site.location}</p>
      {li ? (
        <p>
          <a href={li} rel="noreferrer">
            LinkedIn
          </a>
        </p>
      ) : null}
      <h2>Quote</h2>
      <QuoteForm />
    </div>
  );
}
