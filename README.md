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

1. Import this GitHub repo in the Vercel team **Big Horn Custom Works project**
2. Set env vars from `.env.example` (production + preview)
3. Connect a Blob store so Master Control product adds survive deploys
4. Only then flip DNS when Clint says the preview is good

## Master Control

Open `/master`. Password is `MASTER_CONTROL_PASSWORD` in env.

Add / edit / hide / reorder products, change copy, photos, prices, variants, shipping note, and read quote submissions — no code change.

Public pages strip HTML/JS from admin fields and fall back to seed copy if JSON is messy, so a stray edit cannot SyntaxError the shop.
