import { cleanMultiline, cleanStr } from "./sanitize";
import type { Quote } from "./types";

async function sendViaFormSubmit(quote: Quote, to: string): Promise<boolean> {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: quote.name,
        email: quote.email,
        phone: quote.phone,
        message: quote.need,
        photo: quote.photoUrl,
        _subject: `Quote request from ${quote.name || quote.email}`,
        _template: "box",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendQuoteEmail(quote: Quote): Promise<boolean> {
  const to = cleanStr(process.env.QUOTE_TO_EMAIL, "bighorncustomworks@gmail.com");
  const key = cleanStr(process.env.RESEND_API_KEY);
  if (!key) {
    return sendViaFormSubmit(quote, to);
  }

  const body = [
    `New custom work quote`,
    ``,
    `Name: ${quote.name}`,
    `Email: ${quote.email}`,
    `Phone: ${quote.phone || "(none)"}`,
    ``,
    `What they need:`,
    cleanMultiline(quote.need),
    quote.photoUrl ? `\nPhoto: ${quote.photoUrl}` : "",
    ``,
    `Submitted: ${quote.createdAt}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Big Horn Custom Works <quotes@bighorncustomworks.com>",
        to: [to],
        reply_to: quote.email || undefined,
        subject: `Quote request from ${quote.name || quote.email}`,
        text: body,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
