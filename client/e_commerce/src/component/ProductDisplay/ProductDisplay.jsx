import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { FaRegHeart, FaHeart } from "react-icons/fa";
import { useWishList } from "../../page/WishList";
import { useCart } from "../../context/CartContext.jsx";
import ProductGallery from "../ProductGallery/ProductGallery";
import SizeGuide from "../SizeGuide/SizeGuide";
import "./ProductDisplay.css";

const DEFAULT_MAX_QTY = 10;
const LOW_STOCK_LIMIT = 5;

const CLOTHES_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

const SIZES_BY_CATEGORY = {
  clothes: CLOTHES_SIZES,
  clothing: CLOTHES_SIZES,
  t_shirt: CLOTHES_SIZES,
  tshirt: CLOTHES_SIZES,
  shoes: SHOE_SIZES,
  footwear: SHOE_SIZES,
};

const SIZE_GUIDE_TYPE_BY_CATEGORY = {
  clothes: "clothes",
  clothing: "clothes",
  t_shirt: "clothes",
  tshirt: "clothes",
  shoes: "shoes",
  footwear: "shoes",
};

const COLOR_HEX = {
  black: "#111111",
  white: "#ffffff",
  red: "#c62828",
  blue: "#1e4fa3",
  navy: "#14213d",
  green: "#2e7d32",
  yellow: "#f2c230",
  orange: "#ef6c00",
  pink: "#e86a92",
  purple: "#6a3fa0",
  grey: "#8d8d8d",
  gray: "#8d8d8d",
  brown: "#6d4c33",
  beige: "#d8c3a5",
  cream: "#f3ead7",
  khaki: "#a89968",
  maroon: "#6d1a2a",
  gold: "#c9a24b",
  silver: "#c0c0c0",
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const toNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toNonNegativeNumber = (value) => {
  const number = toNumber(value);
  return number !== null && number >= 0 ? number : null;
};

const toStock = (variant) => {
  const raw =
    variant?.stock_quantity ??
    variant?.stockQuantity ??
    variant?.stock ??
    variant?.quantity_available ??
    variant?.available_quantity ??
    variant?.quantity;

  const number = toNumber(raw);

  return number !== null && Number.isSafeInteger(number) && number >= 0
    ? number
    : null;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;

  if (value === 1 || value === 0) {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "active", "yes"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "inactive", "no"].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const isVariantActive = (variant) => {
  const active = parseBoolean(variant?.is_active ?? variant?.isActive);

  const status = String(variant?.status ?? "")
    .trim()
    .toLowerCase();

  return (
    active !== false &&
    !["inactive", "disabled", "archived", "deleted"].includes(status)
  );
};

const getVariantPrice = (variant) =>
  toNonNegativeNumber(
    variant?.price ??
      variant?.selling_price ??
      variant?.best_price ??
      variant?.base_price,
  );

const getCategoryKey = (value) => {
  const categoryName = isRecord(value)
    ? (value.slug ?? value.name ?? value.title ?? "")
    : value;

  return String(categoryName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
};

const formatPrice = (value) => {
  if (value === null || value === undefined) {
    return "Price unavailable";
  }

  return `ETB ${value.toLocaleString("en-ET", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const normalizeOptionValue = (value) => {
  if (isRecord(value)) {
    value = value.name ?? value.value ?? value.label ?? "";
  }

  return String(value ?? "").trim();
};

/**
 * Supports common API shapes:
 * size: "40"
 * size: "40, 41, 42"
 * sizes: ["40", "41", "42"]
 * attributes: { size: "40" }
 *
 * IMPORTANT:
 * Multiple sizes stored in one variant record cannot represent
 * independent per-size stock or pricing. See notes below.
 */
const getOptionValues = (...values) => {
  for (const value of values) {
    const candidates = Array.isArray(value) ? value : [value];

    const result = candidates
      .flatMap((candidate) => {
        const normalized = normalizeOptionValue(candidate);

        return normalized ? normalized.split(",") : [];
      })
      .map((item) => item.trim())
      .filter(Boolean);

    if (result.length) {
      return [...new Set(result)];
    }
  }

  return [];
};

const getVariantSizes = (variant) =>
  getOptionValues(
    variant?.size,
    variant?.size_name,
    variant?.size_value,
    variant?.sizes,
    variant?.attributes?.size,
    variant?.attributes?.size_name,
    variant?.attributes?.sizes,
  );

const getVariantColors = (variant) =>
  getOptionValues(
    variant?.color,
    variant?.color_name,
    variant?.color_value,
    variant?.colors,
    variant?.attributes?.color,
    variant?.attributes?.color_name,
    variant?.attributes?.colors,
  );

const getVariantSize = (variant) => getVariantSizes(variant)[0] ?? "";

const getVariantColor = (variant) => getVariantColors(variant)[0] ?? "";

const normalizeComparison = (value) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase();

const variantHasSize = (variant, value) =>
  getVariantSizes(variant).some(
    (item) => normalizeComparison(item) === normalizeComparison(value),
  );

const variantHasColor = (variant, value) =>
  getVariantColors(variant).some(
    (item) => normalizeComparison(item) === normalizeComparison(value),
  );

const getVariantId = (variant) =>
  variant?.product_variant_id ?? variant?.variant_id ?? variant?.id ?? null;

const getProductImage = (product) => {
  const primary = product?.image ?? product?.image_url;

  if (typeof primary === "string" && primary.trim()) {
    return primary;
  }

  if (isRecord(primary)) {
    const url = primary.url ?? primary.image_url;

    if (typeof url === "string" && url.trim()) {
      return url;
    }
  }

  const images = Array.isArray(product?.images) ? product.images : [];

  for (const image of images) {
    if (typeof image === "string" && image.trim()) {
      return image;
    }

    if (isRecord(image)) {
      const url = image.url ?? image.image_url;

      if (typeof url === "string" && url.trim()) {
        return url;
      }
    }
  }

  return "";
};

const getLineQuantity = (line) =>
  Math.max(0, toNumber(line?.qty ?? line?.quantity) ?? 0);

const getProductVariants = (product) => {
  const raw =
    product?.variants ?? product?.product_variants ?? product?.productVariants;

  if (Array.isArray(raw)) {
    return raw.filter(isRecord);
  }

  if (isRecord(raw) && Array.isArray(raw.data)) {
    return raw.data.filter(isRecord);
  }

  return [];
};

const ProductDisplay = ({ product }) => {
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const { has, toggle } = useWishList();
  const { addItem, lines = [], MAX_QTY } = useCart();

  const maxQty = Math.max(1, Math.floor(toNumber(MAX_QTY) ?? DEFAULT_MAX_QTY));

  const variants = useMemo(() => getProductVariants(product), [product]);

  const activeVariants = useMemo(
    () => variants.filter(isVariantActive),
    [variants],
  );

  const category = getCategoryKey(
    product?.category ?? product?.category_name ?? product?.category_slug,
  );

  const sizes = useMemo(() => {
    const apiSizes = [...new Set(activeVariants.flatMap(getVariantSizes))];

    const known = SIZES_BY_CATEGORY[category];

    if (!known) {
      return apiSizes;
    }

    return apiSizes.sort((a, b) => {
      const ai = known.indexOf(a);
      const bi = known.indexOf(b);

      if (ai === -1 && bi === -1) {
        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      if (ai === -1) return 1;
      if (bi === -1) return -1;

      return ai - bi;
    });
  }, [activeVariants, category]);

  const colors = useMemo(
    () => [...new Set(activeVariants.flatMap(getVariantColors))],
    [activeVariants],
  );

  const colorHexByName = useMemo(() => {
    const map = {};

    for (const variant of activeVariants) {
      for (const name of getVariantColors(variant)) {
        const key = normalizeComparison(name);

        if (map[key]) continue;

        const explicit = String(
          variant?.color_hex ??
            variant?.hex_code ??
            variant?.hex ??
            variant?.attributes?.color_hex ??
            "",
        ).trim();

        if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(explicit)) {
          map[key] = explicit.startsWith("#") ? explicit : `#${explicit}`;
        } else {
          map[key] = COLOR_HEX[key] ?? "";
        }
      }
    }

    return map;
  }, [activeVariants]);

  const hasVariantSizes = activeVariants.some(
    (variant) => getVariantSizes(variant).length > 0,
  );

  const hasVariantColors = activeVariants.some(
    (variant) => getVariantColors(variant).length > 0,
  );

  const needsVariantSelection = hasVariantSizes || hasVariantColors;

  const productId = product?.id ?? product?.product_id ?? product?.slug;

  const productName = String(
    product?.name ?? product?.title ?? "Product",
  ).trim();

  const customSizeGuide =
    isRecord(product?.size_guide) &&
    Array.isArray(product.size_guide.headers) &&
    Array.isArray(product.size_guide.rows)
      ? product.size_guide
      : null;

  const sizeGuideType =
    SIZE_GUIDE_TYPE_BY_CATEGORY[category] ?? (customSizeGuide ? "clothes" : "");

  const showSizeGuide = hasVariantSizes && Boolean(sizeGuideType);

  /**
   * A valid selection must match the same variant record.
   * Never combine the stock from one variant with the price
   * from another variant.
   */
  const selectedVariant = useMemo(() => {
    if (!needsVariantSelection) {
      return activeVariants[0] ?? null;
    }

    if (hasVariantSizes && !size) return null;
    if (hasVariantColors && !color) return null;

    return (
      activeVariants.find((variant) => {
        const matchesSize = !hasVariantSizes || variantHasSize(variant, size);

        const matchesColor =
          !hasVariantColors || variantHasColor(variant, color);

        return matchesSize && matchesColor;
      }) ?? null
    );
  }, [
    activeVariants,
    needsVariantSelection,
    hasVariantSizes,
    hasVariantColors,
    size,
    color,
  ]);

  const productPrice = toNonNegativeNumber(
    product?.new_price ??
      product?.selling_price ??
      product?.base_price ??
      product?.best_price ??
      product?.price,
  );

  const variantPrices = useMemo(
    () => activeVariants.map(getVariantPrice).filter((value) => value !== null),
    [activeVariants],
  );

  const lowestVariantPrice =
    variantPrices.length > 0 ? Math.min(...variantPrices) : null;

  const highestVariantPrice =
    variantPrices.length > 0 ? Math.max(...variantPrices) : null;

  const pricesDiffer =
    lowestVariantPrice !== null &&
    highestVariantPrice !== null &&
    lowestVariantPrice !== highestVariantPrice;

  const price = needsVariantSelection
    ? selectedVariant
      ? getVariantPrice(selectedVariant)
      : (lowestVariantPrice ?? productPrice)
    : selectedVariant
      ? (getVariantPrice(selectedVariant) ?? productPrice)
      : productPrice;

  const oldPrice = toNonNegativeNumber(
    selectedVariant?.compare_at_price ??
      selectedVariant?.old_price ??
      product?.old_price ??
      product?.compare_at_price,
  );

  const hasPrice = price !== null;
  const hasDiscount = hasPrice && oldPrice !== null && oldPrice > price;

  const discountPercent = hasDiscount
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;

  const showFrom =
    needsVariantSelection &&
    !selectedVariant &&
    pricesDiffer &&
    lowestVariantPrice !== null;

  const productStock = toStock(product);

  const stock = needsVariantSelection
    ? selectedVariant
      ? toStock(selectedVariant)
      : null
    : selectedVariant
      ? (toStock(selectedVariant) ?? productStock)
      : productStock;

  const matchingCartLines = useMemo(() => {
    if (productId == null || !Array.isArray(lines)) {
      return [];
    }

    return lines.filter((line) => {
      const lineProductId = line.productId ?? line.product_id ?? line.id;

      if (String(lineProductId ?? "") !== String(productId)) {
        return false;
      }

      const selectedVariantId = getVariantId(selectedVariant);

      const lineVariantId =
        line.variantId ?? line.product_variant_id ?? line.variant_id ?? null;

      if (selectedVariantId !== null || lineVariantId !== null) {
        return String(lineVariantId ?? "") === String(selectedVariantId ?? "");
      }

      return (
        normalizeComparison(line.size) === normalizeComparison(size) &&
        normalizeComparison(line.color) === normalizeComparison(color)
      );
    });
  }, [lines, productId, selectedVariant, size, color]);

  const inCart = matchingCartLines.reduce(
    (total, line) => total + getLineQuantity(line),
    0,
  );

  const available =
    stock === null ? 0 : Math.max(0, Math.min(maxQty, stock) - inCart);

  const soldOut = stock === 0;
  const stockUnknown = stock === null;
  const maxedInCart = stock !== null && stock > 0 && available === 0;

  const selectionComplete =
    (!hasVariantSizes || Boolean(size)) &&
    (!hasVariantColors || Boolean(color)) &&
    (!needsVariantSelection || Boolean(selectedVariant));

  const canBuy =
    hasPrice &&
    selectionComplete &&
    stock !== null &&
    stock > 0 &&
    available > 0;

  const liked = productId != null ? Boolean(has(productId)) : false;

  const sku = String(selectedVariant?.sku ?? product?.sku ?? "").trim();

  // Reset UI when the customer opens a different product.
  useEffect(() => {
    setSize("");
    setColor("");
    setQty(1);
    setError("");
    setNotice("");
    setAdding(false);
    setGuideOpen(false);
  }, [productId]);

  // Automatically select options when only one exists.
  useEffect(() => {
    setSize((current) => {
      if (current && sizes.includes(current)) return current;
      return sizes.length === 1 ? sizes[0] : "";
    });
  }, [sizes]);

  useEffect(() => {
    setColor((current) => {
      if (current && colors.includes(current)) return current;
      return colors.length === 1 ? colors[0] : "";
    });
  }, [colors]);

  useEffect(() => {
    setQty((current) =>
      Math.max(1, Math.min(current, available > 0 ? available : 1)),
    );
  }, [available]);

  const pickSize = useCallback((nextSize) => {
    setSize(nextSize);
    setQty(1);
    setError("");
    setNotice("");
  }, []);

  const pickColor = useCallback((nextColor) => {
    setColor(nextColor);
    setQty(1);
    setError("");
    setNotice("");
  }, []);

  const changeQty = useCallback(
    (change) => {
      setQty((current) => Math.max(1, Math.min(available, current + change)));
    },
    [available],
  );

  /**
   * Only variants matching the other selected option are used.
   * If a combination does not exist, its option is disabled.
   */
  const getSizeStock = useCallback(
    (sizeValue) => {
      const matching = activeVariants.filter(
        (variant) =>
          variantHasSize(variant, sizeValue) &&
          (!hasVariantColors || !color || variantHasColor(variant, color)),
      );

      if (!matching.length) return 0;

      const knownStocks = matching
        .map(toStock)
        .filter((value) => value !== null);

      if (!knownStocks.length) return null;

      return Math.max(...knownStocks);
    },
    [activeVariants, hasVariantColors, color],
  );

  const getColorStock = useCallback(
    (colorValue) => {
      const matching = activeVariants.filter(
        (variant) =>
          variantHasColor(variant, colorValue) &&
          (!hasVariantSizes || !size || variantHasSize(variant, size)),
      );

      if (!matching.length) return 0;

      const knownStocks = matching
        .map(toStock)
        .filter((value) => value !== null);

      if (!knownStocks.length) return null;

      return Math.max(...knownStocks);
    },
    [activeVariants, hasVariantSizes, size],
  );

  const addToCart = useCallback(async () => {
    if (adding) return;

    setError("");
    setNotice("");

    if (productId == null) {
      setError("This product is missing its ID. Please refresh the page.");
      return;
    }

    if (!hasPrice) {
      setError("The price for this product is not available yet.");
      return;
    }

    if (hasVariantSizes && !size) {
      setError("Please select a size.");
      return;
    }

    if (hasVariantColors && !color) {
      setError("Please select a color.");
      return;
    }

    if (needsVariantSelection && !selectedVariant) {
      setError(
        "This size and color combination is unavailable. Please choose another option.",
      );
      return;
    }

    if (stock === null) {
      setError("Stock information is unavailable. Please try again later.");
      return;
    }

    if (stock <= 0) {
      setError("Sorry, this item is sold out.");
      return;
    }

    if (available <= 0) {
      setError(
        `You cannot add more of this item. Maximum allowed quantity: ${maxQty}.`,
      );
      return;
    }

    const requestedQty = Math.min(qty, available);
    const image = getProductImage(product);
    const variantId = getVariantId(selectedVariant);

    setAdding(true);

    try {
      const result = await addItem({
        id: productId,
        size,
        color,
        qty: requestedQty,
        variantId,
        stock,
        product: {
          id: productId,
          name: productName,
          image,
          category:
            product?.category_name ??
            product?.category?.name ??
            product?.category ??
            "",
          new_price: price,
          old_price: oldPrice,
        },
      });

      if (!result?.ok) {
        if (result?.reason === "soldout") {
          setError("Sorry, this item is sold out.");
        } else if (result?.reason === "limit") {
          setError(
            `You have reached the cart limit${
              result.max != null ? ` of ${result.max}` : ""
            }.`,
          );
        } else {
          setError(
            result?.message ?? "We couldn't add this item. Please try again.",
          );
        }

        return;
      }

      const addedQty = toNumber(result.added) ?? requestedQty;

      setQty(1);

      setNotice(
        `Added ${addedQty} × ${productName}` +
          (size ? ` · Size ${size}` : "") +
          (color ? ` · ${color}` : "") +
          " to your cart.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setAdding(false);
    }
  }, [
    adding,
    productId,
    hasPrice,
    hasVariantSizes,
    hasVariantColors,
    size,
    color,
    needsVariantSelection,
    selectedVariant,
    stock,
    available,
    maxQty,
    qty,
    addItem,
    product,
    productName,
    price,
    oldPrice,
  ]);

  if (!product) return null;

  const categoryLabel = isRecord(product.category)
    ? (product.category.name ?? product.category.slug ?? "")
    : (product.category_name ?? product.category ?? "");

  const stockClass = soldOut
    ? "is-sold-out"
    : stockUnknown
      ? "is-unknown"
      : stock <= LOW_STOCK_LIMIT
        ? "is-low"
        : "is-available";

  return (
    <section className="pdisp" aria-labelledby="pdisp-title">
      <div className="pdisp_gallery">
        <ProductGallery product={product} activeColor={color} />

        {hasDiscount && (
          <span className="pdisp_badge">Save {discountPercent}%</span>
        )}
      </div>

      <div className="pdisp_info">
        {categoryLabel && (
          <p className="pdisp_category">
            {String(categoryLabel).replaceAll("_", " ")}
          </p>
        )}

        <h1 className="pdisp_title" id="pdisp-title">
          {productName}
        </h1>

        <div className="pdisp_price_row">
          <p className="pdisp_price">
            {showFrom && <span className="pdisp_from">From </span>}
            {formatPrice(price)}
          </p>

          {hasDiscount && (
            <p className="pdisp_old_price">{formatPrice(oldPrice)}</p>
          )}

          {hasDiscount && (
            <span className="pdisp_discount_pill">-{discountPercent}%</span>
          )}
        </div>

        {hasDiscount && (
          <p className="pdisp_savings">
            You save {formatPrice(oldPrice - price)}
          </p>
        )}

        <div
          className={`pdisp_stock ${stockClass}`}
          role="status"
          aria-live="polite"
        >
          <span className="pdisp_stock_dot" aria-hidden="true" />

          {soldOut
            ? "Sold out"
            : stockUnknown
              ? needsVariantSelection && !selectedVariant
                ? "Select options to see availability"
                : "Availability not confirmed"
              : stock <= LOW_STOCK_LIMIT
                ? `Only ${stock} left`
                : "In stock"}
        </div>

        {product.description && (
          <p className="pdisp_description">{product.description}</p>
        )}

        {hasVariantColors && (
          <fieldset className="pdisp_fieldset">
            <legend className="pdisp_label">
              Color
              {color && <span className="pdisp_selection"> · {color}</span>}
            </legend>

            <div className="pdisp_options">
              {colors.map((colorValue) => {
                const availableStock = getColorStock(colorValue);
                const unavailable = availableStock === 0;
                const hex = colorHexByName[normalizeComparison(colorValue)];
                const selected =
                  normalizeComparison(color) ===
                  normalizeComparison(colorValue);

                if (!hex) {
                  return (
                    <button
                      key={colorValue}
                      type="button"
                      className={`pdisp_option ${
                        selected ? "is-selected" : ""
                      }`}
                      aria-pressed={selected}
                      disabled={unavailable}
                      onClick={() => pickColor(colorValue)}
                    >
                      {colorValue}
                    </button>
                  );
                }

                return (
                  <button
                    key={colorValue}
                    type="button"
                    className={`pdisp_swatch ${selected ? "is-selected" : ""} ${
                      unavailable ? "is-unavailable" : ""
                    }`}
                    style={{ "--swatch": hex }}
                    aria-label={`${colorValue}${
                      unavailable ? " (sold out)" : ""
                    }`}
                    aria-pressed={selected}
                    title={`${colorValue}${unavailable ? " — Sold out" : ""}`}
                    disabled={unavailable}
                    onClick={() => pickColor(colorValue)}
                  >
                    <span className="pdisp_swatch_fill" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {hasVariantSizes && (
          <fieldset className="pdisp_fieldset">
            <legend className="pdisp_label pdisp_label--row">
              <span>
                Size
                {size && <span className="pdisp_selection"> · {size}</span>}
              </span>

              {showSizeGuide && (
                <button
                  type="button"
                  className="pdisp_guide_link"
                  onClick={() => setGuideOpen(true)}
                >
                  Size guide
                </button>
              )}
            </legend>

            <div className="pdisp_options pdisp_options--sizes">
              {sizes.map((sizeValue) => {
                const availableStock = getSizeStock(sizeValue);
                const unavailable = availableStock === 0;
                const lowStock =
                  availableStock !== null &&
                  availableStock > 0 &&
                  availableStock <= LOW_STOCK_LIMIT;

                const selected = size === sizeValue;

                return (
                  <button
                    key={sizeValue}
                    type="button"
                    className={`pdisp_option ${
                      selected ? "is-selected" : ""
                    } ${lowStock ? "is-low" : ""}`}
                    aria-pressed={selected}
                    aria-label={`Size ${sizeValue}${
                      unavailable
                        ? " (sold out or unavailable)"
                        : lowStock
                          ? ` (only ${availableStock} left)`
                          : ""
                    }`}
                    title={
                      unavailable
                        ? "Unavailable for the selected options"
                        : lowStock
                          ? `Only ${availableStock} left`
                          : undefined
                    }
                    disabled={unavailable}
                    onClick={() => pickSize(sizeValue)}
                  >
                    {sizeValue}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {needsVariantSelection && !selectionComplete && (
          <p className="pdisp_hint">
            Choose an available color and size to check the exact price and
            stock.
          </p>
        )}

        {needsVariantSelection && selectionComplete && !selectedVariant && (
          <p className="pdisp_hint" role="status">
            This combination is unavailable. Please select a different color or
            size.
          </p>
        )}

        {canBuy && (
          <div className="pdisp_quantity_section">
            <span className="pdisp_label">Quantity</span>

            <div className="pdisp_quantity">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={qty <= 1}
                onClick={() => changeQty(-1)}
              >
                −
              </button>

              <output aria-live="polite">{qty}</output>

              <button
                type="button"
                aria-label="Increase quantity"
                disabled={qty >= available}
                onClick={() => changeQty(1)}
              >
                +
              </button>
            </div>

            {inCart > 0 && (
              <p className="pdisp_cart_hint">{inCart} already in your cart</p>
            )}
          </div>
        )}

        {error && (
          <p className="pdisp_message pdisp_message--error" role="alert">
            {error}
          </p>
        )}

        <div className="pdisp_actions">
          <button
            type="button"
            className="pdisp_add_button"
            disabled={!canBuy || adding}
            onClick={addToCart}
          >
            {adding
              ? "Adding to cart…"
              : !hasPrice
                ? "Price unavailable"
                : soldOut
                  ? "Sold out"
                  : stockUnknown && selectionComplete
                    ? "Availability unavailable"
                    : maxedInCart
                      ? "Maximum in cart"
                      : needsVariantSelection && !selectionComplete
                        ? hasVariantSizes && !size
                          ? "Select a size"
                          : "Select a color"
                        : "Add to cart"}
          </button>

          <button
            type="button"
            className={`pdisp_wishlist ${liked ? "is-liked" : ""}`}
            aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={liked}
            onClick={() => {
              if (productId != null) toggle(productId);
            }}
            disabled={productId == null}
          >
            {liked ? (
              <FaHeart aria-hidden="true" />
            ) : (
              <FaRegHeart aria-hidden="true" />
            )}
          </button>
        </div>

        {notice && (
          <div className="pdisp_message pdisp_message--success" role="status">
            <span>{notice}</span>
            <NavLink to="/cart">View cart</NavLink>
          </div>
        )}

        <NavLink to="/contacts" className="pdisp_contact">
          Have a question about this item?
          <span> Ask us</span>
        </NavLink>

        <details className="pdisp_accordion">
          <summary>Product details</summary>

          <dl className="pdisp_details">
            {categoryLabel && (
              <>
                <dt>Category</dt>
                <dd>{String(categoryLabel).replaceAll("_", " ")}</dd>
              </>
            )}

            {sku && (
              <>
                <dt>SKU</dt>
                <dd>{sku}</dd>
              </>
            )}

            {size && (
              <>
                <dt>Size</dt>
                <dd>{size}</dd>
              </>
            )}

            {color && (
              <>
                <dt>Color</dt>
                <dd>{color}</dd>
              </>
            )}
          </dl>
        </details>

        <ul className="pdisp_benefits">
          <li>
            <span aria-hidden="true">✓</span>
            Secure checkout with available payment methods
          </li>
          <li>
            <span aria-hidden="true">✓</span>
            Delivery within Ethiopia
          </li>
        </ul>
      </div>

      {guideOpen && showSizeGuide && (
        <SizeGuide
          type={sizeGuideType}
          custom={customSizeGuide}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </section>
  );
};

export default ProductDisplay;
