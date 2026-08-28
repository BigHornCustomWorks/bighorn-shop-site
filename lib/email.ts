import { cleanMultiline, cleanStr } from "./sanitize";
import type { Quote } from "./types";

function quoteBody(quote: Quote): string {
  return [
    "New custom work quote — Big Horn Custom Works",
    "",
    `Name: ${quote.name}`,
    `Email: ${quote.email}`,
    `Phone: ${quote.phone || "(none)"}`,
    "",
    "What they need:",
    cleanMultiline(quote.need),
    quote.photoUrl ? `\nPhoto: ${quote.photoUrl}` : "",
    "",
    `Submitted: ${quote.createdAt}`,
    "",
    "Open Master Control → Quotes to read the full request.",
  ].join("\n");
}

async function sendViaSmtp(quote: Quote, to: string): Promise<boolean> {
  const user = cleanStr(process.env.SMTP_USER);
  const pass = cleanStr(process.env.SMTP_PASS);
  if (!user || !pass) return false;
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cleanStr(process.env.SMTP_HOST, "smtp.gmail.com"),
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `Big Horn Custom Works <${user}>`,
      to,
      replyTo: quote.email || undefined,
      subject: `Quote request from ${quote.name || quote.email}`,
      text: quoteBody(quote),
    });
    return true;
  } catch {
    return false;
  }
}

async function sendViaResend(quote: Quote, to: string): Promise<boolean> {
  const key = cleanStr(process.env.RESEND_API_KEY);
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Big Horn Custom Works <onboarding@resend.dev>",
        to: [to],
        reply_to: quote.email || undefined,
        subject: `Quote request from ${quote.name || quote.email}`,
        text: quoteBody(quote),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendViaFormSubmit(quote: Quote, to: string): Promise<boolean> {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: quote.name,
        email: quote.email,
        phone: quote.phone,
        message: quoteBody(quote),
        _replyto: quote.email,
        _subject: `Quote request from ${quote.name || quote.email}`,
        _template: "box",
        _captcha: "false",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendQuoteEmail(quote: Quote, toEmail?: string): Promise<boolean> {
  const to = cleanStr(toEmail) || cleanStr(process.env.QUOTE_TO_EMAIL, "bighorncustomworks@gmail.com");
  if (await sendViaSmtp(quote, to)) return true;
  if (await sendViaResend(quote, to)) return true;
  return sendViaFormSubmit(quote, to);
}
