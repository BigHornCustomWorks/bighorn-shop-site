/** Door picture Clint chose, otherwise a photo from a sign in that category. */
export function signDoorPhoto(chosen: string | undefined, fallback: string | undefined): string {
  const picture = (chosen || "").trim();
  if (picture) return picture;
  const photo = (fallback || "").trim();
  return photo || "/logo.png";
}

/** Premade-sign labels are the same line: custom metal signs, cut when ordered. */
export function customMetalCategoryName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (/^pre[-\s]?made(?:\s+metal)?\s+signs$/i.test(trimmed)) return "Custom metal signs";
  return name;
}
