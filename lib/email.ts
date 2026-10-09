import { deliveryEmailText, type DigitalDownload } from "./digital-delivery";
import { paymentLinkEmailText } from "./payment-quote";
import { receiptComment, receiptEmailHtml, receiptEmailText, type ReceiptOrder } from "./receipt";
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
    quote.kind === "sign" ? "Custom metal sign request" : "What they need:",
    cleanMultiline(quote.need),
    quote.widthIn || quote.heightIn
      ? `Size: ${quote.widthIn} × ${quote.heightIn} in`
      : "",
    quote.finishName ? `Finish: ${quote.finishName}` : "",
    quote.fulfillment ? `Fulfillment: ${quote.fulfillment}` : "",
    quote.estimateLabel ? `Estimate shown: ${quote.estimateLabel}` : "",
    quote.sampleUrl ? `Sample they picked: ${quote.sampleUrl}` : "",
    quote.photoUrl ? `Photo: ${quote.photoUrl}` : "",
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

export async function sendShopMail(opts: {
  subject: string;
  text: string;
  replyTo?: string;
  to?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<boolean> {
  const to = cleanStr(opts.to) || shopInbox();
  const replyTo = cleanStr(opts.replyTo);
  const attachments = (opts.attachments || []).filter((file) => file.content?.length);
  const user = cleanStr(process.env.SMTP_USER);
  const pass = cleanStr(process.env.SMTP_PASS);
  if (user && pass) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cleanStr(process.env.SMTP_HOST, "smtp.gmail.com"),
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: { user, pass },
    });
    const payload = {
      from: `Big Horn Custom Works <${user}>`,
      to,
      replyTo: replyTo || undefined,
      subject: opts.subject,
      text: opts.text,
    };
    try {
      await transporter.sendMail({
        ...payload,
        attachments: attachments.map((file) => ({
          filename: file.filename,
          content: file.content,
          contentType: file.contentType || "application/octet-stream",
        })),
      });
      return true;
    } catch (err) {
      console.error("smtp attachments:", err instanceof Error ? err.message : err);
      if (attachments.length) {
        try {
          await transporter.sendMail({
            ...payload,
            text: `${opts.text}\n\nThe photos could not be attached to this email. The links above still open them.`,
          });
          return true;
        } catch (err2) {
          console.error("smtp:", err2 instanceof Error ? err2.message : err2);
        }
      }
    }
  }
  return sendPlainEmail({ subject: opts.subject, text: opts.text, replyTo, to });
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
 * Resend's shared onboarding address is not a shop mailbox. Buyer mail uses
 * Gmail SMTP, or RESEND_FROM once that domain is verified.
 */
function verifiedResendFrom(): string {
  const from = cleanStr(process.env.RESEND_FROM);
  if (!from || /onboarding@resend\.dev/i.test(from)) return "";
  const plain = /^[^\s<>]+@[^\s<>]+$/;
  const named = /^.+<[^\s<>]+@[^\s<>]+>$/;
  if (!plain.test(from) && !named.test(from)) return "";
  return from;
}

/**
 * Mail addressed to a customer rather than to the shop. FormSubmit is
 * deliberately not a fallback here: it delivers to an inbox its owner has to
 * activate, which is fine for Clint's inbox and useless for a stranger's.
 */
async function sendCustomerEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const to = cleanStr(opts.to);
  if (!to) return false;
  const html = opts.html?.trim() || "";

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
        ...(html ? { html } : {}),
      });
      return true;
    } catch {
      /* fall through to Resend */
    }
  }

  const resendKey = cleanStr(process.env.RESEND_API_KEY);
  const resendFrom = verifiedResendFrom();
  if (resendKey && resendFrom) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          reply_to: shopInbox(),
          subject: opts.subject,
          text: opts.text,
          ...(html ? { html } : {}),
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  return false;
}

export async function sendDigitalDeliveryEmail(detail: {
  to: string;
  name: string;
  downloads: DigitalDownload[];
  alsoPhysical?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const downloads = (detail.downloads || [])
    .map((item) => ({
      name: cleanStr(item.name, "Download"),
      urls: (item.urls || []).map((url) => cleanStr(url)).filter((url) => url.startsWith("https://")),
    }))
    .filter((item) => item.urls.length);
  if (!cleanStr(detail.to)) return { ok: false, error: "This order has no customer email." };
  if (!downloads.length) {
    return {
      ok: false,
      error: "No HTTPS file links are saved on the digital items in this order.",
    };
  }
  const ok = await sendCustomerEmail({
    to: detail.to,
    subject: "Your Big Horn Custom Works download",
    text: deliveryEmailText(cleanStr(detail.name), downloads, Boolean(detail.alsoPhysical)),
  });
  if (!ok) {
    return {
      ok: false,
      error: "The download email did not send. SMTP is missing or failed, and no verified Resend domain is set.",
    };
  }
  return { ok: true };
}

export async function sendReceiptEmail(
  detail: ReceiptOrder & { to: string; logoUrl?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!cleanStr(detail.to)) return { ok: false, error: "This order has no customer email." };
  const order: ReceiptOrder = { ...detail, comment: receiptComment(detail.comment || "") };
  const ok = await sendCustomerEmail({
    to: detail.to,
    subject: "Your receipt from Big Horn Custom Works",
    text: receiptEmailText(order),
    html: receiptEmailHtml(order, detail.logoUrl || ""),
  });
  if (!ok) {
    return {
      ok: false,
      error: "The receipt did not send. SMTP is missing or failed, and no verified Resend domain is set.",
    };
  }
  return { ok: true };
}

export async function sendPaymentQuoteEmail(detail: {
  to: string;
  name: string;
  title: string;
  detail: string;
  amountLabel: string;
  url: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!cleanStr(detail.to)) return { ok: false, error: "Enter the customer's email." };
  if (!cleanStr(detail.url)) return { ok: false, error: "This quote has no payment link." };
  const ok = await sendCustomerEmail({
    to: detail.to,
    subject: "Your quote from Big Horn Custom Works",
    text: paymentLinkEmailText(detail),
  });
  if (!ok) {
    return {
      ok: false,
      error: "The email did not send. The link is saved — use Copy link and send it yourself.",
    };
  }
  return { ok: true };
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

/** Owner-clicked Google review request. SMTP only, and the real error comes back. */
export async function sendReviewRequestEmail(opts: {
  to: string;
  name: string;
  reviewUrl: string;
  brand?: "shop" | "repair";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = cleanStr(opts.to);
  const reviewUrl = cleanStr(opts.reviewUrl);
  const brand = opts.brand === "repair" ? "repair" : "shop";
  const business = brand === "repair" ? "Repair Status" : "Big Horn Custom Works";
  if (!to) return { ok: false, error: "This order has no customer email." };
  if (!reviewUrl) {
    return {
      ok: false,
      error: `Add the ${business} Google review link in Settings, then save, before sending.`,
    };
  }

  const user = cleanStr(process.env.SMTP_USER);
  const pass = cleanStr(process.env.SMTP_PASS);
  if (!user || !pass) {
    return { ok: false, error: "SMTP_USER / SMTP_PASS is not set, so the review email was not sent." };
  }

  const name = cleanStr(opts.name);
  const text =
    brand === "repair"
      ? [
          name ? `Hi ${name},` : "Hi,",
          "",
          "Thanks for using Repair Status, from Big Horn Custom Works.",
          "If you have a minute, a Google review helps other shops find it.",
          "",
          reviewUrl,
          "",
          "— Clint, Big Horn Custom Works",
        ].join("\n")
      : [
          name ? `Hi ${name},` : "Hi,",
          "",
          "Thanks for your order from Big Horn Custom Works.",
          "If you have a minute, a Google review helps other people find the Sheridan shop.",
          "",
          reviewUrl,
          "",
          "— Clint, Big Horn Custom Works",
        ].join("\n");

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
      subject:
        brand === "repair"
          ? "Thanks for using Repair Status"
          : "Thanks for your order from Big Horn Custom Works",
      text,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "The review email failed.";
    return { ok: false, error: message };
  }
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
