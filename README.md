# Big Horn Custom Works

Public shop site for Big Horn Custom Works LLC (Sheridan, Wyoming). This is **not** Shopify.

- Catalog checkout: Stripe Checkout (test mode until live keys are set)
- Custom jobs: quote form → Master Control inbox (email if Resend is set; otherwise FormSubmit + inbox)
- Repair Status is a text link only — not a catalog product and not $0

## Local

```
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000

## Vercel preview (do not attach bighorncustomworks.com yet)

One-click import (public source): https://vercel.com/new/clone?repository-url=https://github.com/BigHornCustomWorks/bighorn-shop-site

Or import the private repo `BigHornCustomWorks/bighorn-custom-works` in the Vercel team **Big Horn Custom Works project**.

Then:

1. Set env vars from `.env.example` (production + preview)
2. Connect durable storage so Master Control product adds survive deploys (prefer Cloudflare R2 — see below; Blob still works as fallback)
3. Only then flip DNS when Clint says the preview is good

## Master Control

Open `/master`. Password is `MASTER_CONTROL_PASSWORD` in env.

Add / edit / hide / reorder products, change copy, photos, prices, variants, shipping note, and read quote submissions — no code change.

Public pages strip HTML/JS from admin fields and fall back to seed copy if JSON is messy, so a stray edit cannot SyntaxError the shop.

## Durable storage (Cloudflare R2 preferred)

Hobby Blob freezes after 2,000 advanced ops/month. The shop prefers R2 when configured; Blob remains a fallback during migration.

Env (Vercel Production):

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=bhcw-store
R2_PUBLIC_BASE_URL=https://pub-XXXX.r2.dev
```

Keep `BLOB_READ_WRITE_TOKEN` until one successful R2 save of `store.json`, then you can remove it.
