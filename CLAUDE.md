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
| `app/api/` | `checkout`, `quote`, `visit`, `shipping/rates`, `webhook/stripe`, `master/{login,logout,store,upload,order-ship,order-label}` |
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

Each product can carry its own `shippingCents`. If any physical item in the
cart has one, it overrides the shop-wide rates for that order; items left at
0 ship along free. `settings.shippingCombine` decides how several priced
items combine — `highest` (default, one box) or `sum` (each needs its own).

Shipping defaults to a single $14.99 flat rate when nothing is configured,
so the shop can never quietly ship for free.

### Live carrier rates (Shippo)

`lib/shipping.ts` talks to Shippo's REST API (no SDK). Live rates turn on
only when `SHIPPO_API_KEY` is set, a ship-from address exists (Master Control
Settings, else `SHIP_FROM_*` env), and the parcel can be computed:

- Catalog items: item weight + a box preset from Settings (or the product's
  own L×W×H and empty box weight). Parcel weight = item weight + empty box
  weight + the packaging allowance. Several units stack into one parcel.
- Custom signs: width × height × thickness × density (steel 0.284, aluminum
  0.0975 lb/in³ by default, editable in the Signs tab), in a flat pack of
  sign size + margin (default 2 in) at a thin depth, plus cardboard weight
  and a packaging allowance.

The cart / sign estimator asks for a ZIP and `/api/shipping/rates` returns
USPS/UPS rates. The browser sends back only the shipment and rate ids;
`/api/checkout` re-fetches the rate by id from Shippo, checks its shipment is
for this exact parcel and ship-from ZIP and under Shippo's 7-day limit, and
passes Shippo's amount to Stripe as the one paid `shipping_option` (pickup
still offered). Rate/shipment ids ride in session metadata and on the order.
Any missing config, missing measurement, or API error falls back to the flat
rates above.

Master Control shows "Generate shipping label" on paid orders with a live
rate (`/api/master/order-label`, `isMaster()`-gated). It buys the checkout
rate when the quote was for the full Stripe address and is fresh; otherwise
it re-rates and shows the price difference for confirmation. A saved label, a
2-minute "buying" lock, and a Shippo lookup of existing transactions on every
rate tied to the order guard against double purchase. Buying a label never
emails the customer; the existing tracking button still does that.
Unit tests: `npm test` (mocked Shippo, Node 22.6+).

After buying a label, Clint pastes the tracking number into the order in
Master Control and it emails the customer a tracking link (POST
`/api/master/order-ship`). Customer-facing mail goes SMTP then Resend and
never falls back to FormSubmit, which only delivers to an inbox its owner
has activated.

Sales tax is Stripe Tax (`automatic_tax`), gated behind the `taxEnabled`
setting so it stays off until Stripe Tax is actually configured in the
Dashboard. Stripe prices must carry `tax_behavior`, which is write-once — a
price created without it breaks the whole session, so the catalog sync
recreates any price missing it and records `stripeTaxBehavior` on the product.

## Uploads

Vercel caps any request passing through a serverless function at 4.5 MB.
Master Control therefore uploads **client-side**: the browser gets a token
from `/api/blob-upload` and sends the file straight to Blob, skipping that
cap. Photos are shrunk in the browser first (`lib/compressImage.ts`).

`/api/blob-upload` sits outside `/api/master` on purpose — Blob calls it
back server-to-server with no session cookie, so the master middleware
would block it. Auth happens in `onBeforeGenerateToken`, which only runs on
the request the browser itself makes.

`/api/master/upload` remains as a fallback for local dev and is genuinely
limited to 4.5 MB. All limits live in `lib/uploadLimits.ts`.

## Env

Names live in `.env.example`; real values in gitignored `.env.local`.
`MASTER_CONTROL_PASSWORD`, `MASTER_SESSION_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `BLOB_READ_WRITE_TOKEN`,
`RESEND_API_KEY`, `SMTP_*`, `QUOTE_TO_EMAIL`, `NEXT_PUBLIC_SITE_URL`,
`SHIPPO_API_KEY`, `SHIP_FROM_*`.

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
