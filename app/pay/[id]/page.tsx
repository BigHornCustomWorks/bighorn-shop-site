import type { Metadata } from "next";
import { PayQuote } from "@/components/PayQuote";
import { paymentQuoteBlock, tokensEqual } from "@/lib/payment-quote";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Pay a quote",
};

function QuoteMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="wrap">
      <h1>{title}</h1>
      <p>{body}</p>
    </div>
  );
}

export default async function PayQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const token = Array.isArray(query.t) ? query.t[0] || "" : query.t || "";
  const store = await readStore();
  const quote = (store.paymentQuotes || []).find((row) => row.id === id);
  if (!quote || !tokensEqual(quote.token, token)) {
    return (
      <QuoteMessage
        title="Payment link not found"
        body="This link is not valid. Ask Big Horn Custom Works for a new one."
      />
    );
  }
  const block = paymentQuoteBlock(quote.status, quote.createdAt);
  if (block) {
    return <QuoteMessage title={quote.title} body={block} />;
  }
  return (
    <PayQuote
      id={quote.id}
      token={quote.token}
      title={quote.title}
      detail={quote.detail}
      amountCents={quote.amountCents}
      pickupEnabled={store.site.pickupEnabled !== false}
    />
  );
}
