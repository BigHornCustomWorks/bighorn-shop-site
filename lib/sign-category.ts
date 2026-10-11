/** Premade-sign labels are the same line: custom metal signs, cut when ordered. */
export function customMetalCategoryName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (/^pre[-\s]?made(?:\s+metal)?\s+signs$/i.test(trimmed)) return "Custom metal signs";
  return name;
}
