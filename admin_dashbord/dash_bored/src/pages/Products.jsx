import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Power,
  Package,
  X,
  ImagePlus,
  Trash2,
  Star,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { apiRequest, assetUrl, withQuery } from "../../src/lib/api.js";
import Modal from "./Modal.jsx";
import "./css/AdminPages.css";
import "./css/Productimage.css";

/* ================================================================
   API CONFIG
   ================================================================ */
const PRODUCTS = "/api/products";
const CATEGORIES = "/api/category";
const LIMIT = 12;

/* ---------- Image rules ---------- */
const IMAGES_FIELD = "images"; // repeated multipart field (new files only)
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_MB = 2;
const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
const MAX_IMAGES = 8;

// Values must match what the storefront gallery understands.
const VIEW_OPTIONS = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "side", label: "Side" },
  { value: "left", label: "Left side" },
  { value: "right", label: "Right side" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom / sole" },
  { value: "detail", label: "Detail / close-up" },
  { value: "model", label: "On model" },
  { value: "lifestyle", label: "Lifestyle" },
];
const VIEW_LABEL = Object.fromEntries(
  VIEW_OPTIONS.map((v) => [v.value, v.label]),
);
const VIEW_SUGGEST_ORDER = ["front", "back", "side", "detail"];

/* ---------- Size / color suggestions ---------- */
const CLOTHES_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

const SIZE_SUGGESTIONS_BY_CATEGORY = {
  clothes: CLOTHES_SIZES,
  clothing: CLOTHES_SIZES,
  t_shirt: CLOTHES_SIZES,
  tshirt: CLOTHES_SIZES,
  shoes: SHOE_SIZES,
  footwear: SHOE_SIZES,
};

const COLOR_SUGGESTIONS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Navy",
  "Green",
  "Yellow",
  "Orange",
  "Pink",
  "Purple",
  "Grey",
  "Brown",
  "Beige",
  "Cream",
  "Khaki",
  "Maroon",
  "Gold",
  "Silver",
];

const HEX_RE = /^#[0-9a-f]{6}$/i;

/* ---------- Helpers ---------- */
const unwrap = (res) => res?.data ?? res;

const toList = (res) => {
  const data = unwrap(res);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.categories)) return data.categories;
  if (Array.isArray(data?.data)) return data.data;
  throw new Error("Invalid list response from server.");
};

const toPaging = (res) => {
  const data = unwrap(res);
  return (
    data?.pagination ?? data?.meta ?? res?.pagination ?? res?.meta ?? data ?? {}
  );
};

const getProduct = (res) => {
  const data = unwrap(res);
  const product = data?.product ?? data?.item ?? data?.data?.product ?? data;
  if (
    !product ||
    typeof product !== "object" ||
    Array.isArray(product) ||
    product.id == null
  ) {
    throw new Error("Invalid product response from server.");
  }
  return product;
};

const getErrorMessage = (err, fallback) =>
  typeof err?.message === "string" && err.message.trim()
    ? err.message
    : fallback;

const categoryKey = (category) =>
  String(category?.slug ?? category?.name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

// "xl" -> "XL", "  m " -> "M", "42" stays "42".
const normalizeSize = (value) => {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return /^[a-z]{1,4}$/i.test(text) ? text.toUpperCase() : text;
};

// "black " -> "Black"
const normalizeColor = (value) => {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/* ---------- Status ---------- */
const isActive = (product) => {
  const value = product?.is_active;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "1" || normalized === "true") return true;
    if (normalized === "0" || normalized === "false") return false;
  }

  // Backward compatibility for API responses that expose only `status`.
  if (product?.status != null) {
    return String(product.status).toLowerCase() === "active";
  }

  return false;
};

// Variants are active unless the API explicitly says otherwise.
const variantIsActive = (variant) =>
  variant?.is_active == null && variant?.status == null
    ? true
    : isActive(variant);

// The PATCH /api/products/:id/status controller expects `is_active`.
const statusBody = (active) => ({ is_active: active });

/* ---------- Images (API -> form) ---------- */
const toImageEntry = (raw, index) => {
  if (typeof raw === "string") {
    const url = raw.trim();
    return url
      ? {
          id: null,
          url,
          view: "",
          color: "",
          alt: "",
          order: index,
          primary: false,
          index,
        }
      : null;
  }

  if (!raw || typeof raw !== "object") return null;

  const url = String(raw.url ?? raw.image_url ?? "").trim();
  if (!url) return null;

  const order = Number(raw.sort_order);

  return {
    id: raw.id ?? null,
    url,
    view: String(raw.view ?? "")
      .trim()
      .toLowerCase(),
    color: normalizeColor(raw.color ?? raw.color_name),
    alt: String(raw.alt ?? raw.alt_text ?? "").trim(),
    order: Number.isFinite(order) ? order : index,
    primary:
      raw.is_primary === true || raw.is_primary === 1 || raw.is_primary === "1",
    index,
  };
};

const sortedImages = (product) =>
  (Array.isArray(product?.images) ? product.images : [])
    .map(toImageEntry)
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.index - b.index);

// Thumbnail for the table: the main image, else the first one.
const productImage = (product) => {
  const images = sortedImages(product);
  const main = images.find((image) => image.primary) ?? images[0];
  if (main) return main.url;

  const legacy = product?.image ?? product?.image_url ?? "";
  return typeof legacy === "string" ? legacy : "";
};

// Exactly one main image whenever there is at least one image.
const ensurePrimary = (images) => {
  if (!images.length) return images;
  const found = images.findIndex((image) => image.is_primary);
  const mainIndex = found === -1 ? 0 : found;
  return images.map((image, i) =>
    image.is_primary === (i === mainIndex)
      ? image
      : { ...image, is_primary: i === mainIndex },
  );
};

function ProductThumb({ src, size = 18 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <Package size={size} />;
  return <img src={assetUrl(src)} alt="" onError={() => setFailed(true)} />;
}

/* ---------- Variants ---------- */
const emptyVariant = () => ({
  sku: "",
  size: "",
  color: "",
  color_hex: "",
  price: "",
  compare_at_price: "",
  stock: "",
  is_active: true,
});

const variantStock = (v) =>
  Number(v.stock ?? v.quantity ?? v.inventory?.quantity ?? 0);
const variantPrice = (v) => Number(v.price ?? 0);

const emptyForm = () => ({
  name: "",
  description: "",
  category_id: "",
  variants: [emptyVariant()],
  images: [],
  removedImageIds: [],
});

const toForm = (product) => ({
  id: product.id,
  name: product.name ?? "",
  description: product.description ?? "",
  category_id: product.category_id ?? product.category?.id ?? "",
  variants:
    Array.isArray(product.variants) && product.variants.length
      ? product.variants.map((v) => ({
          id: v.id,
          sku: v.sku ?? "",
          size: v.size ?? v.attributes?.size ?? "",
          color: v.color ?? v.attributes?.color ?? "",
          color_hex: HEX_RE.test(String(v.color_hex ?? v.hex_code ?? ""))
            ? String(v.color_hex ?? v.hex_code)
            : "",
          price: variantPrice(v),
          compare_at_price: v.compare_at_price ?? v.old_price ?? "",
          stock: variantStock(v),
          is_active: variantIsActive(v),
        }))
      : [emptyVariant()],
  // Only images that have an id can be edited / reordered / removed.
  images: ensurePrimary(
    sortedImages(product)
      .filter((image) => image.id != null)
      .map((image) => ({
        key: `e-${image.id}`,
        id: image.id,
        url: image.url,
        file: null,
        preview: "",
        view: image.view,
        color: image.color,
        alt: image.alt,
        is_primary: image.primary,
      })),
  ),
  removedImageIds: [],
});

// Used to detect unsaved changes (File objects are reduced to name + size).
const snapshot = (form) =>
  JSON.stringify({
    name: form.name,
    description: form.description,
    category_id: form.category_id,
    variants: form.variants,
    images: form.images.map((image) => ({
      key: image.key,
      id: image.id,
      view: image.view,
      color: image.color,
      alt: image.alt,
      is_primary: image.is_primary,
      file: image.file ? `${image.file.name}:${image.file.size}` : null,
    })),
    removed: form.removedImageIds,
  });

/* ---------- Validation ---------- */
const validateForm = (form) => {
  if (!form.name.trim()) return "Product name is required.";
  if (!form.variants.length) return "Add at least one variant.";

  const skus = new Set();
  const combos = new Set();
  const hexByColor = new Map();

  for (let i = 0; i < form.variants.length; i++) {
    const v = form.variants[i];
    const label = `Variant ${i + 1}`;
    const price = Number(v.price);
    const stock = Number(v.stock);
    const sku = v.sku.trim();
    const size = normalizeSize(v.size);
    const color = normalizeColor(v.color);

    if (!sku) return `${label}: SKU is required.`;
    if (!size) return `${label}: Size is required.`;
    if (!color) return `${label}: Color is required.`;

    if (v.price === "" || !Number.isFinite(price) || price < 0) {
      return `${label}: Enter a valid non-negative price.`;
    }

    if (v.compare_at_price !== "" && v.compare_at_price != null) {
      const compare = Number(v.compare_at_price);
      if (!Number.isFinite(compare) || compare <= price) {
        return `${label}: Old price must be higher than the price (or leave it empty).`;
      }
    }

    if (
      v.stock === "" ||
      !Number.isFinite(stock) ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return `${label}: Stock must be a non-negative whole number.`;
    }

    if (v.color_hex && !HEX_RE.test(v.color_hex)) {
      return `${label}: Swatch color is not valid.`;
    }

    const skuKey = sku.toLowerCase();
    if (skus.has(skuKey)) {
      return `${label}: SKU "${sku}" is already used by another variant.`;
    }
    skus.add(skuKey);

    const comboKey = `${size.toLowerCase()}|${color.toLowerCase()}`;
    if (combos.has(comboKey)) {
      return `${label}: ${size} / ${color} already exists. Each size and color pair must be unique.`;
    }
    combos.add(comboKey);

    if (v.color_hex) {
      const colorKey = color.toLowerCase();
      const known = hexByColor.get(colorKey);
      if (known && known.toLowerCase() !== v.color_hex.toLowerCase()) {
        return `${label}: ${color} has a different swatch color than another ${color} variant.`;
      }
      hexByColor.set(colorKey, v.color_hex);
    }
  }

  if (!form.images.length) return "Add at least one product image.";

  const variantColors = new Set(
    form.variants.map((v) => normalizeColor(v.color).toLowerCase()),
  );

  for (let i = 0; i < form.images.length; i++) {
    const image = form.images[i];
    if (!image.view) return `Image ${i + 1}: choose which view it shows.`;
    if (image.color && !variantColors.has(image.color.toLowerCase())) {
      return `Image ${i + 1}: color "${image.color}" is not used by any variant.`;
    }
  }

  return "";
};

/* ---------- Payload ---------- */
/*
  multipart/form-data
    name, description, category_id
    variants          JSON array
    images_meta       JSON array in display order (see below)
    images            new files, in the same order as the entries marked
                      "new: true" inside images_meta
    removed_image_ids JSON array of image ids to delete
*/
const toPayload = (form) => {
  const data = new FormData();
  data.append("name", form.name.trim());
  data.append("description", (form.description ?? "").trim());
  data.append(
    "category_id",
    form.category_id === "" || form.category_id == null
      ? ""
      : String(Number(form.category_id)),
  );

  data.append(
    "variants",
    JSON.stringify(
      form.variants.map((v) => ({
        ...(v.id != null ? { id: v.id } : {}),
        sku: v.sku.trim(),
        size: normalizeSize(v.size),
        color: normalizeColor(v.color),
        color_hex: v.color_hex || null,
        price: Number(v.price),
        compare_at_price:
          v.compare_at_price === "" || v.compare_at_price == null
            ? null
            : Number(v.compare_at_price),
        stock: Number(v.stock),
        is_active: Boolean(v.is_active),
      })),
    ),
  );

  const newFiles = [];

  const meta = form.images.map((image, index) => {
    const entry = {
      view: image.view,
      color: image.color ? normalizeColor(image.color) : null,
      alt: image.alt || null,
      is_primary: Boolean(image.is_primary),
      sort_order: index,
    };

    if (image.id != null) {
      entry.id = image.id;
    } else {
      entry.new = true;
      newFiles.push(image.file);
    }

    return entry;
  });

  data.append("images_meta", JSON.stringify(meta));
  newFiles.forEach((file) => data.append(IMAGES_FIELD, file));

  if (form.removedImageIds.length) {
    data.append("removed_image_ids", JSON.stringify(form.removedImageIds));
  }

  return data;
};

/* ---------- Display helpers ---------- */
const money = (value) =>
  `ETB ${Number(value ?? 0).toLocaleString("en-ET", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const rowStock = (product) => {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.reduce((sum, v) => sum + variantStock(v), 0);
  }
  return Number(product.stock ?? 0);
};

const rowPrice = (product) => {
  const prices = (product.variants ?? []).map(variantPrice);
  if (!prices.length) return money(product.price ?? product.base_price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? money(low) : `${money(low)} – ${money(high)}`;
};

const banner = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  marginBottom: 16,
};

export default function Products() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [dragging, setDragging] = useState(false);

  const initialRef = useRef("");
  const imageKeyRef = useRef(0);
  const previewsRef = useRef(new Set());
  const errorRef = useRef(null);

  const categoryName = useCallback(
    (product) =>
      product.category_name ??
      product.category?.name ??
      categories.find((c) => String(c.id) === String(product.category_id))
        ?.name ??
      "—",
    [categories],
  );

  /* ---------- Load products ---------- */
  const load = useCallback(
    async (signal) => {
      setError("");
      try {
        const response = await apiRequest(
          withQuery(PRODUCTS, { page, limit: LIMIT }),
          { signal },
        );
        if (signal?.aborted) return;

        const list = toList(response);
        const paging = toPaging(response);
        setItems(list);

        const reportedPages = Number(paging.totalPages ?? paging.total_pages);
        const reportedTotal = Number(paging.total);

        if (Number.isFinite(reportedPages) && reportedPages > 0) {
          setTotalPages(reportedPages);
        } else if (Number.isFinite(reportedTotal) && reportedTotal >= 0) {
          setTotalPages(Math.max(1, Math.ceil(reportedTotal / LIMIT)));
        } else {
          setTotalPages(list.length === LIMIT ? page + 1 : page);
        }
      } catch (err) {
        if (err?.name !== "AbortError" && !signal?.aborted) {
          setError(getErrorMessage(err, "Failed to load products."));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /* ---------- Load categories ---------- */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiRequest(CATEGORIES, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setCategories(toList(response));
      } catch (err) {
        if (err?.name !== "AbortError" && !controller.signal.aborted) {
          setError(getErrorMessage(err, "Failed to load categories."));
        }
      }
    })();
    return () => controller.abort();
  }, []);

  const refreshProducts = async () => {
    setRefreshing(true);
    await load();
  };

  /* ---------- Client-side filter (current page only) ---------- */
  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((p) => {
      const matchesCategory =
        cat === "all" || String(p.category_id ?? p.category?.id ?? "") === cat;
      const matchesName = String(p.name ?? "")
        .toLowerCase()
        .includes(search);
      return matchesCategory && matchesName;
    });
  }, [items, query, cat]);

  /* ---------- Preview URL cleanup ---------- */
  const revokeAllPreviews = () => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
  };

  useEffect(() => revokeAllPreviews, []);

  /* ---------- Show form errors even if the form is scrolled ---------- */
  useEffect(() => {
    if (formError) {
      errorRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [formError]);

  /* ---------- Derived form data ---------- */
  const isDirty = form ? snapshot(form) !== initialRef.current : false;

  const sizeSuggestions = useMemo(() => {
    const selected = categories.find(
      (c) => String(c.id) === String(form?.category_id ?? ""),
    );
    return SIZE_SUGGESTIONS_BY_CATEGORY[categoryKey(selected)] ?? [];
  }, [categories, form?.category_id]);

  const imageColors = useMemo(
    () => [
      ...new Set(
        (form?.variants ?? [])
          .map((v) => normalizeColor(v.color))
          .filter(Boolean),
      ),
    ],
    [form?.variants],
  );

  const hasFrontView = form?.images.some((image) => image.view === "front");
  const imagesFull = (form?.images.length ?? 0) >= MAX_IMAGES;

  /* ---------- Form open / close ---------- */
  const closeForm = () => {
    revokeAllPreviews();
    setForm(null);
    setFormError("");
    setDragging(false);
  };

  const requestClose = () => {
    if (saving) return;
    if (isDirty && !window.confirm("Discard your unsaved changes?")) return;
    closeForm();
  };

  const openAdd = () => {
    const next = emptyForm();
    initialRef.current = snapshot(next);
    setFormError("");
    setEditing(false);
    setForm(next);
  };

  const openEdit = async (product) => {
    if (editing || saving || statusUpdatingId !== null) return;
    setFormError("");
    setError("");
    setEditing(true);
    try {
      const response = await apiRequest(
        `${PRODUCTS}/${encodeURIComponent(product.id)}`,
      );
      const next = toForm(getProduct(response));
      initialRef.current = snapshot(next);
      setForm(next);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load product details."));
    } finally {
      setEditing(false);
    }
  };

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((curr) => (curr ? { ...curr, [key]: value } : curr));
  };

  /* ---------- Image handlers ---------- */
  const addImages = (fileList) => {
    if (!form || saving) return;

    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) {
      setFormError(`You can add up to ${MAX_IMAGES} images.`);
      return;
    }

    const problems = [];
    const accepted = [];

    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) {
        problems.push(`${file.name}: must be JPG, PNG or WEBP`);
        continue;
      }
      if (file.size > IMAGE_MAX_BYTES) {
        problems.push(`${file.name}: larger than ${IMAGE_MAX_MB} MB`);
        continue;
      }
      if (accepted.length >= room) {
        problems.push(
          `Only ${MAX_IMAGES} images are allowed — extra files skipped`,
        );
        break;
      }
      accepted.push(file);
    }

    setFormError(problems.join(" · "));
    if (!accepted.length) return;

    const usedViews = new Set(form.images.map((image) => image.view));

    const added = accepted.map((file) => {
      const view =
        VIEW_SUGGEST_ORDER.find((v) => !usedViews.has(v)) ?? "detail";
      usedViews.add(view);

      const preview = URL.createObjectURL(file);
      previewsRef.current.add(preview);
      imageKeyRef.current += 1;

      return {
        key: `n-${imageKeyRef.current}`,
        id: null,
        url: "",
        file,
        preview,
        view,
        color: "",
        alt: "",
        is_primary: false,
      };
    });

    setForm((curr) =>
      curr
        ? { ...curr, images: ensurePrimary([...curr.images, ...added]) }
        : curr,
    );
  };

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    addImages(files);
  };

  const onDropFiles = (e) => {
    e.preventDefault();
    setDragging(false);
    addImages(e.dataTransfer?.files);
  };

  const updateImage = (key, patch) => {
    setForm((curr) =>
      curr
        ? {
            ...curr,
            images: curr.images.map((image) =>
              image.key === key ? { ...image, ...patch } : image,
            ),
          }
        : curr,
    );
  };

  const setPrimaryImage = (key) => {
    setForm((curr) =>
      curr
        ? {
            ...curr,
            images: curr.images.map((image) => ({
              ...image,
              is_primary: image.key === key,
            })),
          }
        : curr,
    );
  };

  const moveImage = (key, direction) => {
    setForm((curr) => {
      if (!curr) return curr;
      const from = curr.images.findIndex((image) => image.key === key);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= curr.images.length) return curr;

      const images = [...curr.images];
      [images[from], images[to]] = [images[to], images[from]];
      return { ...curr, images };
    });
  };

  const removeImageEntry = (key) => {
    const target = form?.images.find((image) => image.key === key);
    if (!target) return;

    if (target.preview) {
      URL.revokeObjectURL(target.preview);
      previewsRef.current.delete(target.preview);
    }

    setForm((curr) =>
      curr
        ? {
            ...curr,
            images: ensurePrimary(
              curr.images.filter((image) => image.key !== key),
            ),
            removedImageIds:
              target.id != null
                ? [...curr.removedImageIds, target.id]
                : curr.removedImageIds,
          }
        : curr,
    );
  };

  /* ---------- Variant handlers ---------- */
  const patchVariant = (index, patch) => {
    setForm((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        variants: curr.variants.map((v, i) =>
          i === index ? { ...v, ...patch } : v,
        ),
      };
    });
  };

  const setVariant = (index, key) => (e) =>
    patchVariant(index, { [key]: e.target.value });

  const addVariant = () => {
    setForm((curr) =>
      curr ? { ...curr, variants: [...curr.variants, emptyVariant()] } : curr,
    );
  };

  const removeVariant = (index) => {
    setForm((curr) => {
      if (!curr || curr.variants.length <= 1) return curr;
      return {
        ...curr,
        variants: curr.variants.filter((_, i) => i !== index),
      };
    });
  };

  /* ---------- Save ---------- */
  const save = async (e) => {
    e.preventDefault();
    if (!form || saving || editing) return;

    const problem = validateForm(form);
    if (problem) {
      setFormError(problem);
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const body = toPayload(form);
      if (form.id != null) {
        await apiRequest(`${PRODUCTS}/${encodeURIComponent(form.id)}`, {
          method: "PUT",
          body,
        });
      } else {
        await apiRequest(PRODUCTS, { method: "POST", body });
      }
      closeForm();
      await refreshProducts();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save product."));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Status toggle ---------- */
  const toggleStatus = async (product) => {
    if (statusUpdatingId !== null || saving || editing) return;
    const next = !isActive(product);
    const action = next ? "Reactivate" : "Deactivate";
    if (!window.confirm(`${action} "${product.name}"?`)) return;

    setError("");
    setStatusUpdatingId(product.id);
    try {
      await apiRequest(`${PRODUCTS}/${encodeURIComponent(product.id)}/status`, {
        method: "PATCH",
        body: statusBody(next),
      });
      await refreshProducts();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update product status."));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const busy = saving || editing || statusUpdatingId !== null;

  return (
    <>
      <div className="pg-head">
        <div className="sa-page-head">
          <h1>Products</h1>
          <p>Manage clothing, t-shirts, shoes & more — size, color & stock</p>
        </div>
        <button className="sa-btn primary" onClick={openAdd} disabled={busy}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {error && (
        <div style={banner} role="alert">
          {error}
        </div>
      )}

      <div className="sa-card">
        <div className="pg-toolbar">
          <label className="pg-search">
            <Search size={16} />
            <input
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <select
            className="pg-select"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="pg-table-wrap">
          <table className="sa-table pg-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="pv-hide-xs">Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th className="pv-hide-sm">Variants</th>
                <th>Status</th>
                <th className="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const stock = rowStock(product);
                const active = isActive(product);
                const variantCount = product.variants?.length ?? 0;

                return (
                  <tr key={product.id}>
                    <td>
                      <span className="sa-thumb">
                        <ProductThumb src={productImage(product)} />
                      </span>
                      {product.name}
                    </td>
                    <td className="pv-hide-xs">{categoryName(product)}</td>
                    <td>{rowPrice(product)}</td>
                    <td>
                      <span
                        className={`sa-badge ${
                          stock === 0 ? "out" : stock <= 10 ? "low" : "ok"
                        }`}
                      >
                        {stock === 0 ? "Out of stock" : stock}
                      </span>
                    </td>
                    <td className="pv-hide-sm">
                      <span className="muted">
                        {variantCount} variant{variantCount !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`sa-badge ${active ? "active" : "draft"}`}
                      >
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="r">
                      <button
                        className="sa-icon-btn"
                        aria-label={`Edit ${product.name}`}
                        title="Edit"
                        disabled={busy}
                        onClick={() => openEdit(product)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className={`sa-icon-btn ${active ? "danger" : ""}`}
                        aria-label={
                          active
                            ? `Deactivate ${product.name}`
                            : `Reactivate ${product.name}`
                        }
                        title={active ? "Deactivate" : "Reactivate"}
                        disabled={busy}
                        onClick={() => toggleStatus(product)}
                      >
                        <Power size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && <p className="pg-empty">Loading products...</p>}
          {!loading && visible.length === 0 && (
            <p className="pg-empty">No products found.</p>
          )}
          {refreshing && <p className="pg-empty">Refreshing...</p>}
        </div>

        <div className="pg-toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
          <span className="muted">
            Page {page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="sa-btn ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="sa-btn ghost"
              disabled={loading || totalPages == null || page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ==================== ADD / EDIT MODAL ==================== */}
      {form && (
        <Modal
          title={form.id != null ? "Edit product" : "Add product"}
          onClose={requestClose}
        >
          <form className="pg-form" onSubmit={save}>
            {formError && (
              <div style={banner} role="alert" ref={errorRef}>
                {formError}
              </div>
            )}

            <label className="pg-field">
              Product Name
              <input
                value={form.name}
                onChange={setField("name")}
                required
                maxLength={150}
                disabled={saving}
                placeholder="e.g. Classic Cotton T-Shirt"
              />
            </label>

            <label className="pg-field">
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={setField("description")}
                disabled={saving}
                placeholder="Material, fit, care instructions..."
              />
            </label>

            <label className="pg-field">
              Category
              <select
                value={form.category_id}
                onChange={setField("category_id")}
                disabled={saving}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="pi-hint">
                The category decides which size guide customers see.
              </span>
            </label>

            {/* ---------------- Images ---------------- */}
            <div className="pg-field">
              <div className="pi-head">
                <strong>Product images</strong>
                <span className="pi-count">
                  {form.images.length} / {MAX_IMAGES}
                </span>
              </div>

              <div
                className={`pi-dropzone ${dragging ? "is-dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!saving && !imagesFull) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDropFiles}
              >
                <ImagePlus size={24} aria-hidden="true" />
                <span>Drag photos here, or</span>

                <label
                  className="sa-btn ghost pi-pick"
                  aria-disabled={saving || imagesFull}
                >
                  Choose images
                  <input
                    className="pi-file"
                    type="file"
                    multiple
                    accept={IMAGE_TYPES.join(",")}
                    onChange={onPickFiles}
                    disabled={saving || imagesFull}
                  />
                </label>

                <span className="pi-hint">
                  JPG, PNG or WEBP · max {IMAGE_MAX_MB} MB each · best size
                  1200×1500 px (4:5) on a plain background
                </span>
              </div>

              {form.images.length > 0 && (
                <ul className="pi-grid">
                  {form.images.map((image, index) => (
                    <li
                      key={image.key}
                      className={`pi-card ${image.is_primary ? "is-primary" : ""}`}
                    >
                      <div className="pi-preview">
                        <img
                          src={image.preview || assetUrl(image.url)}
                          alt={`${VIEW_LABEL[image.view] ?? "Product"} view`}
                        />
                        {image.is_primary && (
                          <span className="pi-badge">Main</span>
                        )}
                        <span className="pi-index">{index + 1}</span>
                      </div>

                      <div className="pi-card-body">
                        <label className="pv-field">
                          <span className="pv-label">View</span>
                          <select
                            value={image.view}
                            onChange={(e) =>
                              updateImage(image.key, { view: e.target.value })
                            }
                            disabled={saving}
                          >
                            <option value="" disabled>
                              Select view
                            </option>
                            {VIEW_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="pv-field">
                          <span className="pv-label">Color</span>
                          <select
                            value={image.color}
                            onChange={(e) =>
                              updateImage(image.key, { color: e.target.value })
                            }
                            disabled={saving}
                          >
                            <option value="">All colors</option>
                            {imageColors.map((color) => (
                              <option key={color} value={color}>
                                {color}
                              </option>
                            ))}
                            {image.color &&
                              !imageColors.includes(image.color) && (
                                <option value={image.color}>
                                  {image.color} (not used)
                                </option>
                              )}
                          </select>
                        </label>
                      </div>

                      <div className="pi-card-actions">
                        <button
                          type="button"
                          className={`sa-icon-btn ${image.is_primary ? "is-on" : ""}`}
                          aria-label="Use as main image"
                          aria-pressed={image.is_primary}
                          title="Use as main image"
                          onClick={() => setPrimaryImage(image.key)}
                          disabled={saving}
                        >
                          <Star size={15} />
                        </button>
                        <button
                          type="button"
                          className="sa-icon-btn"
                          aria-label="Move image earlier"
                          title="Move earlier"
                          onClick={() => moveImage(image.key, -1)}
                          disabled={saving || index === 0}
                        >
                          <ArrowLeft size={15} />
                        </button>
                        <button
                          type="button"
                          className="sa-icon-btn"
                          aria-label="Move image later"
                          title="Move later"
                          onClick={() => moveImage(image.key, 1)}
                          disabled={saving || index === form.images.length - 1}
                        >
                          <ArrowRight size={15} />
                        </button>
                        <button
                          type="button"
                          className="sa-icon-btn danger"
                          aria-label="Remove image"
                          title="Remove"
                          onClick={() => removeImageEntry(image.key)}
                          disabled={saving}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {form.images.length > 0 && !hasFrontView && (
                <p className="pi-warning">
                  Tip: add a Front view so customers see the main angle first.
                </p>
              )}
              {form.images.length > 0 && (
                <p className="pi-hint">
                  The order here is the order customers see. Tie an image to a
                  color to show it only when that color is selected.
                </p>
              )}
            </div>

            {/* ---------------- Variants ---------------- */}
            <div className="pg-field">
              <div className="pi-head">
                <strong>Variants (Size · Color · Stock)</strong>
                <button
                  type="button"
                  className="sa-btn ghost"
                  onClick={addVariant}
                  disabled={saving}
                  style={{ fontSize: 13 }}
                >
                  <Plus size={14} /> Add variant
                </button>
              </div>

              <datalist id="pv-sizes">
                {sizeSuggestions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
              <datalist id="pv-colors">
                {COLOR_SUGGESTIONS.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>

              <div className="pv-list">
                {form.variants.map((variant, index) => (
                  <div
                    key={variant.id ?? `new-${index}`}
                    className={`pv-card ${variant.is_active ? "" : "is-inactive"}`}
                  >
                    <div className="pv-card-head">
                      <strong>Variant {index + 1}</strong>

                      <div className="pv-card-tools">
                        <label className="pv-toggle">
                          <input
                            type="checkbox"
                            checked={variant.is_active}
                            onChange={(e) =>
                              patchVariant(index, {
                                is_active: e.target.checked,
                              })
                            }
                            disabled={saving}
                          />
                          Active
                        </label>
                        <button
                          type="button"
                          className="sa-icon-btn danger"
                          aria-label={`Remove variant ${index + 1}`}
                          onClick={() => removeVariant(index)}
                          disabled={saving || form.variants.length === 1}
                          title="Remove"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="pv-fields">
                      <label className="pv-field">
                        <span className="pv-label">SKU</span>
                        <input
                          placeholder="e.g. TS-BLK-M"
                          value={variant.sku}
                          onChange={setVariant(index, "sku")}
                          required
                          disabled={saving}
                        />
                      </label>

                      <label className="pv-field">
                        <span className="pv-label">Size</span>
                        <input
                          list="pv-sizes"
                          placeholder="S, M, 42..."
                          value={variant.size}
                          onChange={setVariant(index, "size")}
                          required
                          disabled={saving}
                        />
                      </label>

                      <div className="pv-field">
                        <span className="pv-label">Color</span>
                        <div className="pv-color-row">
                          <input
                            list="pv-colors"
                            aria-label={`Variant ${index + 1} color name`}
                            placeholder="e.g. Black"
                            value={variant.color}
                            onChange={setVariant(index, "color")}
                            required
                            disabled={saving}
                          />
                          <input
                            type="color"
                            className="pv-swatch-input"
                            aria-label={`Variant ${index + 1} swatch color (optional)`}
                            title="Swatch color (optional)"
                            value={variant.color_hex || "#000000"}
                            onChange={(e) =>
                              patchVariant(index, { color_hex: e.target.value })
                            }
                            disabled={saving}
                          />
                          {variant.color_hex && (
                            <button
                              type="button"
                              className="sa-icon-btn"
                              aria-label="Clear swatch color"
                              title="Clear swatch color"
                              onClick={() =>
                                patchVariant(index, { color_hex: "" })
                              }
                              disabled={saving}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <label className="pv-field">
                        <span className="pv-label">Price (ETB)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={variant.price}
                          onChange={setVariant(index, "price")}
                          required
                          disabled={saving}
                        />
                      </label>

                      <label className="pv-field">
                        <span className="pv-label">Old price (optional)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="Before discount"
                          value={variant.compare_at_price}
                          onChange={setVariant(index, "compare_at_price")}
                          disabled={saving}
                        />
                      </label>

                      <label className="pv-field">
                        <span className="pv-label">Stock</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          placeholder="0"
                          value={variant.stock}
                          onChange={setVariant(index, "stock")}
                          required
                          disabled={saving}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pg-form-actions">
              <button
                type="button"
                className="sa-btn ghost"
                onClick={requestClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="sa-btn primary"
                disabled={saving || editing}
              >
                {saving ? "Saving..." : "Save product"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
