# Big Horn Custom Works — shop site

Public storefront for Big Horn Custom Works LLC (Sheridan, Wyoming).
Explicitly **not** Shopify. Catalog checkout runs on Stripe Checkout;
custom jobs go through a quote form into a Master Control inbox.

Started with Grok; development continues under Claude Code.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript. Stripe for checkout,
Vercel Blob for uploaded media, Nodemailer/Resend for mail. No CSS
framework — plain `app/globals.css`.

## Commands

```bash
npm run dev     # localhost:3000
npm run build   # production build
npm run start   # serve the build
```

## Layout

| Path | Purpose |
| --- | --- |
| `app/` | Routes. Public: `/`, `/shop`, `/shop/[slug]`, `/cart`, `/custom`, `/contact`, `/about`, `/privacy`, `/terms` |
| `app/master/` | Master Control admin UI (`MasterClient.tsx`) |
| `app/api/` | `checkout`, `quote`, `visit`, `webhook/stripe`, `master/{login,logout,store,upload}` |
| `lib/store.ts` | Reads/writes the store document — products, categories, quotes, site copy, settings, stats, orders |
| `lib/auth.ts` | HMAC-signed master session cookie (`bhcw_master`) |
| `lib/sanitize.ts` | Strips HTML/JS from admin-entered fields |
| `lib/seed.ts` | Fallback copy when the store JSON is missing or malformed |
| `data/store.json` | Local seed/snapshot of the store document |

## Master Control

`/master`, gated by `MASTER_CONTROL_PASSWORD`. Lets the owner add, edit,
hide, and reorder products, change copy, photos, prices, variants, and
shipping notes, and read quote submissions — all without a code change.

Auth is deliberately two-layer: `middleware.ts` does a cheap shape check
on the cookie at the edge (it cannot use `node:crypto`), then
`isMaster()` does the real HMAC verification inside `app/master/page.tsx`
and every `/api/master/*` route. **Don't treat the middleware check as
the security boundary, and don't remove the `isMaster()` calls.**

Public pages sanitize admin fields and fall back to seed copy, so a bad
admin edit cannot break the storefront.

## Shipping and tax

Shipping is **not** a line item. Rates live in `site.shippingOptions` (max 5,
Stripe's limit), are edited in Master Control, and are sent as real Stripe
`shipping_options` so the customer picks a service on the payment page. The
chosen service and its cost land on the order email so the right label gets
bought. A legacy flat `shippingCents` migrates into a single option.

Sales tax is Stripe Tax (`automatic_tax`), gated behind the `taxEnabled`
setting so it stays off until Stripe Tax is actually configured in the
Dashboard. Stripe prices must carry `tax_behavior`, which is write-once — a
price created without it breaks the whole session, so the catalog sync
recreates any price missing it and records `stripeTaxBehavior` on the product.

## Env

Names live in `.env.example`; real values in gitignored `.env.local`.
`MASTER_CONTROL_PASSWORD`, `MASTER_SESSION_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `BLOB_READ_WRITE_TOKEN`,
`RESEND_API_KEY`, `SMTP_*`, `QUOTE_TO_EMAIL`, `NEXT_PUBLIC_SITE_URL`.

Never commit or echo secret values.

## Deploy

- Vercel project `bighorn-shop-site` (team: Big Horn Custom Works).
- Two remotes: `origin` = private `bighorn-custom-works`,
  `public` = `bighorn-shop-site` (used for the one-click clone URL).
- **The live domain bighorncustomworks.com is not attached yet** — the
  README says to keep it on preview until Clint approves.

## Conventions

- Repair Status is a **text link only** — never a catalog product, never $0.
- Commit messages: short imperative sentences.
- Don't commit or push unless asked.
