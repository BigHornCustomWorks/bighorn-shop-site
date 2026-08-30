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

function formOrigin(): string {
  return cleanStr(process.env.NEXT_PUBLIC_SITE_URL, "https://bighorncustomworks.com").replace(/\/$/, "");
}

async function formSubmit(to: string, fields: Record<string, string>): Promise<boolean> {
  const origin = formOrigin();
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: origin,
        Referer: `${origin}/`,
      },
      body: JSON.stringify({
        ...fields,
        _template: "box",
        _captcha: "false",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean | string; message?: string };
    const ok = json.success === true || json.success === "true";
    if (!ok) {
      console.error("formsubmit", json.message || res.status);
    }
    return ok;
  } catch {
    return false;
  }
}

async function sendViaFormSubmit(quote: Quote, to: string): Promise<boolean> {
  return formSubmit(to, {
    name: quote.name,
    email: quote.email,
    phone: quote.phone,
    message: quoteBody(quote),
    _replyto: quote.email,
    _subject: `Quote request from ${quote.name || quote.email}`,
  });
}

export async function sendQuoteEmail(quote: Quote, toEmail?: string): Promise<boolean> {
  const to = cleanStr(toEmail) || shopInbox();
  if (await sendViaSmtp(quote, to)) return true;
  if (await sendViaResend(quote, to)) return true;
  return sendViaFormSubmit(quote, to);
}

function shopInbox(): string {
  return cleanStr(process.env.QUOTE_TO_EMAIL, "bighorncustomworks@gmail.com");
}

export async function sendPlainEmail(opts: {
  subject: string;
  text: string;
  replyTo?: string;
  to?: string;
}): Promise<boolean> {
  const to = cleanStr(opts.to) || shopInbox();
  const replyTo = cleanStr(opts.replyTo);

  const user = cleanStr(process.env.SMTP_USER);
  const pass = cleanStr(process.env.SMTP_PASS);
  if (user && pass) {
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
        replyTo: replyTo || undefined,
        subject: opts.subject,
        text: opts.text,
      });
      return true;
    } catch {
      /* fall through */
    }
  }

  const resendKey = cleanStr(process.env.RESEND_API_KEY);
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Big Horn Custom Works <onboarding@resend.dev>",
          to: [to],
          reply_to: replyTo || undefined,
          subject: opts.subject,
          text: opts.text,
        }),
      });
      if (res.ok) return true;
    } catch {
      /* fall through */
    }
  }

  return formSubmit(to, {
    name: "Catalog order",
    email: replyTo || to,
    message: opts.text,
    _replyto: replyTo,
    _subject: opts.subject,
  });
}

/**
 * Mail addressed to a customer rather than to the shop. FormSubmit is
 * deliberately not a fallback here: it delivers to an inbox its owner has to
 * activate, which is fine for Clint's inbox and useless for a stranger's.
 */
async function sendCustomerEmail(opts: { to: string; subject: string; text: string }): Promise<boolean> {
  const to = cleanStr(opts.to);
  if (!to) return false;

  const user = cleanStr(process.env.SMTP_USER);
  const pass = cleanStr(process.env.SMTP_PASS);
  if (user && pass) {
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
        replyTo: shopInbox(),
        subject: opts.subject,
        text: opts.text,
      });
      return true;
    } catch {
      /* fall through to Resend */
    }
  }

  const resendKey = cleanStr(process.env.RESEND_API_KEY);
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Big Horn Custom Works <onboarding@resend.dev>",
          to: [to],
          reply_to: shopInbox(),
          subject: opts.subject,
          text: opts.text,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  return false;
}

export async function sendShippedEmail(detail: {
  to: string;
  name: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  items: string;
}): Promise<boolean> {
  const carrier = detail.carrier || "the carrier";
  const lines = [
    detail.name ? `${detail.name},` : "Hi,",
    "",
    "Your order from Big Horn Custom Works has shipped from Sheridan, Wyoming.",
    "",
    `Carrier: ${carrier}`,
    `Tracking number: ${detail.trackingNumber}`,
  ];
  if (detail.trackingUrl) lines.push(`Track it: ${detail.trackingUrl}`);
  if (detail.items) lines.push("", "On the way:", detail.items);
  lines.push("", "Reply to this email if anything looks wrong.", "", "— Clint, Big Horn Custom Works");

  return sendCustomerEmail({
    to: detail.to,
    subject: `Your Big Horn Custom Works order shipped — ${carrier} ${detail.trackingNumber}`,
    text: lines.join("\n"),
  });
}

export async function sendOrderEmail(detail: {
  email: string;
  name: string;
  amountLabel: string;
  items: string;
  address: string;
  sessionId: string;
  paid: boolean;
  shippingLabel?: string;
  shippingLabelCost?: string;
  taxLabel?: string;
}): Promise<boolean> {
  const text = [
    "New catalog order — Big Horn Custom Works",
    "",
    `Paid: ${detail.paid ? "yes (Stripe)" : "no"}`,
    `Total: ${detail.amountLabel}`,
    `Customer: ${detail.name || "(none)"}`,
    `Email: ${detail.email || "(none)"}`,
    "",
    "Items:",
    detail.items || "(none listed)",
    "",
    detail.shippingLabel
      ? `Shipping paid: ${detail.shippingLabel} — ${detail.shippingLabelCost || ""} (buy this label)`
      : "Shipping paid: none selected",
    detail.taxLabel ? `Sales tax collected: ${detail.taxLabel}` : "",
    "",
    detail.address ? `Ship to:\n${detail.address}` : "No shipping address (digital or not collected).",
    "",
    `Stripe session: ${detail.sessionId}`,
    "",
    "This is the Sheridan shop inbox. Stripe also shows the payment in the Dashboard.",
  ].join("\n");
  return sendPlainEmail({
    subject: `Order ${detail.amountLabel} from ${detail.email || detail.name || "checkout"}`,
    text,
    replyTo: detail.email,
  });
}
