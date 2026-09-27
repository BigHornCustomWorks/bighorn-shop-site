/** Product codes are a number (221). A clone adds a letter: 221b, 221c, … */

export function skuStem(sku: string): string {
  const text = sku.trim();
  const numbered = text.match(/^(\d+)([a-z])?$/i);
  if (numbered) return numbered[1];
  return text;
}

export function nextProductCode(products: { sku?: string }[]): string {
  let max = 220;
  for (const product of products) {
    const stem = skuStem(product.sku || "");
    const n = Number(stem);
    if (stem && String(n) === stem && n > max) max = n;
  }
  const used = new Set(products.map((p) => (p.sku || "").toLowerCase()));
  let next = max + 1;
  while (used.has(String(next))) next += 1;
  return String(next);
}

export function nextCloneCode(sourceSku: string, products: { sku?: string }[]): string {
  const stem = skuStem(sourceSku) || nextProductCode(products);
  const used = new Set(products.map((p) => (p.sku || "").toLowerCase()));
  for (let i = 1; i < 26; i += 1) {
    const code = `${stem}${String.fromCharCode(97 + i)}`;
    if (!used.has(code.toLowerCase())) return code;
  }
  return `${stem}-${products.length + 1}`;
}
