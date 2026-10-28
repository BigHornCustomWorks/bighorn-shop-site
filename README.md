# BHCW: Vercel Blob → Cloudflare R2

## Why
Hobby plan freezes Blob after 2,000 advanced ops/month (writes/lists). That blocked payment-request / Master Control durable saves. R2 free tier is enough for BHCW; site stays on Vercel Hobby at $0.

## Code (already staged in `/workspace/bighorn-shop-site`)
- `lib/r2.ts` — S3 client helpers (get/put/delete/presign)
- `lib/store.ts` — prefers R2 for store.json; Blob fallback during migration
- `app/api/blob-upload/route.ts` — R2 presign + legacy Blob handleUpload
- `app/master/MasterClient.tsx` — browser PUT to R2 first
- `app/api/master/upload`, `quote`, `service-request` — R2 then Blob
- `next.config.ts` — allow `*.r2.dev` images
- `package.json` — `@aws-sdk/client-s3` + `s3-request-presigner`

## Cloudflare setup (after connector auth)
1. Create R2 bucket `bhcw-store` (or similar)
2. Enable public access via R2.dev subdomain OR custom domain `media.bighorncustomworks.com`
3. Create R2 API token with Object Read & Write on that bucket
4. Note Account ID

## Vercel Production env
```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=bhcw-store
R2_PUBLIC_BASE_URL=https://pub-XXXX.r2.dev
```
Keep `BLOB_READ_WRITE_TOKEN` temporarily to migrate the existing store.json, then remove after one successful R2 save.

## Migrate existing data
1. Deploy code with R2 env set
2. One-time: copy Blob `bhcw/store-*.json` (and optional media) into R2 under same keys — or open Master Control and Save once after seeding from Blob fallback
3. Confirm Master Control shows "Cloudflare R2 (durable)"
4. Test a payment-request / order write
5. Remove Blob token when stable

## Repo
https://github.com/BigHornCustomWorks/bighorn-shop-site
