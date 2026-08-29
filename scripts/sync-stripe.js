const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");

const root = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
const key = (env.match(/^STRIPE_SECRET_KEY=(.+)$/m) || [])[1];
if (!key) {
  console.error("No STRIPE_SECRET_KEY in .env.local");
  process.exit(1);
}

const storePath = path.join(root, "data", "store.json");
const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
const stripe = new Stripe(key.trim());

async function run() {
  let n = 0;
  for (const product of store.products || []) {
    if (!product.name || !product.priceCents) continue;
    const images = (product.photos || [])
      .filter((u) => typeof u === "string" && u.startsWith("https://"))
      .slice(0, 8);
    let productId = product.stripeProductId;
    if (productId) {
      await stripe.products.update(productId, {
        name: product.name,
        description: (product.description || "").slice(0, 400) || undefined,
        images,
        active: product.visible !== false,
        metadata: { shop_id: product.id, slug: product.slug },
      });
    } else {
      const created = await stripe.products.create({
        name: product.name,
        description: (product.description || "").slice(0, 400) || undefined,
        images,
        active: product.visible !== false,
        metadata: { shop_id: product.id, slug: product.slug },
      });
      productId = created.id;
    }
    let priceId = product.stripePriceId;
    if (!priceId || product.stripePriceCents !== product.priceCents) {
      if (priceId) await stripe.prices.update(priceId, { active: false }).catch(() => undefined);
      const price = await stripe.prices.create({
        product: productId,
        currency: "usd",
        unit_amount: product.priceCents,
        nickname: product.name,
        lookup_key: `bhcw_${product.id}_${product.priceCents}`,
        transfer_lookup_key: true,
        metadata: { shop_id: product.id },
      });
      priceId = price.id;
    }
    product.stripeProductId = productId;
    product.stripePriceId = priceId;
    product.stripePriceCents = product.priceCents;
    n += 1;
    console.log("synced", product.name);
  }
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  console.log("done", n);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
