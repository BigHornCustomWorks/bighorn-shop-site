import { readStore } from "@/lib/store";

export default async function AboutPage() {
  const { site } = await readStore();
  return (
    <div className="wrap">
      <p className="section-kicker">About</p>
      <h1>{site.companyName}</h1>
      <p className="lede" style={{ whiteSpace: "pre-wrap" }}>
        {site.aboutBody}
      </p>
      <p>
        {site.location}. {site.legalName}.
      </p>
    </div>
  );
}
