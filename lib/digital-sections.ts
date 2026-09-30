/** Two rooms on /digital. Software is programs. Files are STL and other downloads. */

export const DIGITAL_SOFTWARE = "Software";
export const DIGITAL_FILES = "Digital files";

const FILE_CATEGORY = /\bstl\b|\bfiles?\b|download|\bmodels?\b|\bcad\b/i;
const SOFTWARE_CATEGORY = /software|program|\bapp\b|\btools?\b|^digital( products)?$/i;

export function digitalSection(product: {
  slug?: string;
  name?: string;
  category?: string;
}): "software" | "files" {
  const slug = (product.slug || "").trim().toLowerCase();
  const name = (product.name || "").trim().toLowerCase();
  if (slug === "repair-status" || name === "repair status") return "software";
  const category = (product.category || "").trim();
  if (FILE_CATEGORY.test(category)) return "files";
  if (SOFTWARE_CATEGORY.test(category)) return "software";
  return "software";
}
