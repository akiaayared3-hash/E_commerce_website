// Product search engine: ranking, partial words, typo tolerance, "did you mean".
// Works on any product shaped like { id, name, category, new_price, image, ... }.

// lowercase, remove accents and symbols (keeps Amharic and other letters)
export const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// edit distance with early exit once it exceeds `max`
const distance = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};

// how many typos we allow for a word of this length
const allowedEdits = (len) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

// Build once per product list (cheap to keep in useMemo)
// Accepts a flat array OR an object/array of groups (e.g. { clothes: [...], shoes: [...] })
// and returns one flat list of products without duplicate ids.
export const flattenProducts = (data) => {
  const out = [];
  const seen = new Set();
  const walk = (item) => {
    if (!item) return;
    if (Array.isArray(item)) return item.forEach(walk);
    if (
      typeof item === "object" &&
      item.name !== undefined &&
      item.id !== undefined
    ) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
      return;
    }
    if (typeof item === "object") Object.values(item).forEach(walk);
  };
  walk(data);
  return out;
};

export const buildIndex = (data = []) => {
  const products = flattenProducts(data);
  const vocab = new Set();
  const entries = products.map((product) => {
    const name = normalize(product.name);
    const category = normalize(
      String(product.category || "").replace(/_/g, " "),
    );
    const extra = normalize(
      [product.brand, product.description, ...(product.tags || [])]
        .filter(Boolean)
        .join(" "),
    );
    const nameWords = name.split(" ").filter(Boolean);
    const catWords = category.split(" ").filter(Boolean);
    nameWords.forEach((w) => w.length > 2 && vocab.add(w));
    catWords.forEach((w) => w.length > 2 && vocab.add(w));
    return { product, name, category, extra, nameWords, catWords };
  });
  return { entries, vocab: [...vocab] };
};

// score one query word against a list of words (0 = no match)
const scoreWords = (token, words) => {
  let best = 0;
  const edits = allowedEdits(token.length);
  for (const w of words) {
    let s = 0;
    if (w === token) s = 100;
    else if (w.startsWith(token)) s = 80;
    else if (token.length >= 3 && w.includes(token)) s = 50;
    else if (edits > 0) {
      const d = distance(token, w, edits);
      if (d <= edits) s = 45 - d * 10;
    }
    if (s > best) best = s;
  }
  return best;
};

const scoreEntry = (e, tokens, phrase) => {
  let total = 0;
  for (const t of tokens) {
    let s = scoreWords(t, e.nameWords);
    const c = scoreWords(t, e.catWords) * 0.6;
    if (c > s) s = c;
    if (!s && e.extra.includes(t)) s = 20;
    if (!s) return 0; // every word must match something
    total += s;
  }
  if (e.name === phrase) total += 120;
  else if (e.name.startsWith(phrase)) total += 60;
  else if (e.name.includes(phrase)) total += 40;
  return total;
};

// Returns products, best match first
export const searchProducts = (index, query, limit = 50) => {
  const phrase = normalize(query);
  if (!phrase) return [];
  const tokens = phrase.split(" ");
  return index.entries
    .map((e) => ({ e, s: scoreEntry(e, tokens, phrase) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e.product);
};

// "Did you mean ...?" for queries with no results. Returns "" if nothing close.
export const didYouMean = (index, query) => {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return "";
  let changed = false;
  const fixed = tokens.map((t) => {
    if (index.vocab.includes(t)) return t;
    let best = t;
    let bestD = 3;
    for (const w of index.vocab) {
      const d = distance(t, w, 2);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (best !== t) changed = true;
    return best;
  });
  return changed ? fixed.join(" ") : "";
};

// Split text into pieces so matching words can be shown in bold
export const highlightParts = (text, query) => {
  const words = normalize(query)
    .split(" ")
    .filter((w) => w.length > 1)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const str = String(text || "");
  if (!words.length) return [{ text: str, hit: false }];
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return str
    .split(re)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      hit: re.test(part) && ((re.lastIndex = 0), true),
    }));
};
