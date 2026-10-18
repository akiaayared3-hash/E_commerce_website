export const slugify = (text) => {
  const slug = String(text ?? "")
    .normalize("NFKD") // split accented letters: é -> e + accent mark
    .replace(/[\u0300-\u036f]/g, "") // remove the accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // anything else becomes one hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens from both ends
    .slice(0, 200); // column is 225; leaves room for "-2", "-3"

  // Names with no Latin letters or numbers (for example Amharic only)
  // would give an empty slug, so use a fallback.
  return slug || `product-${Date.now()}`;
};
