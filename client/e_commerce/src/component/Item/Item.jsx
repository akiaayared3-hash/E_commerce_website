import React, { memo, useCallback, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { FaRegHeart, FaHeart } from "react-icons/fa";

import { useWishList } from "../../page/WishList";
import "./Item.css";

/* =========================================================
   Configuration
========================================================= */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const FALLBACK_IMAGE = "";

/* =========================================================
   Helpers
========================================================= */

const formatPrice = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Price unavailable";
  }

  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return "Price unavailable";
  }

  return `ETB ${price.toLocaleString("en-ET", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

const getCategoryName = (category) => {
  if (typeof category === "string" && category.trim()) {
    return category.trim().replaceAll("_", "-");
  }

  if (category && typeof category === "object") {
    return category.name ?? category.title ?? "Product";
  }

  return "Product";
};

const getProductId = (product) =>
  product?.id ??
  product?.product_id ??
  product?.productId ??
  product?.slug ??
  null;

const getProductName = (product) =>
  product?.name ??
  product?.product_name ??
  product?.title ??
  "Untitled product";

const getRawImage = (product) => {
  const images = product?.images;

  const firstImage = Array.isArray(images) ? images[0] : null;

  const image =
    product?.image ??
    product?.image_url ??
    product?.image_path ??
    product?.main_image ??
    product?.primary_image ??
    product?.thumbnail ??
    (typeof firstImage === "string" ? firstImage : null) ??
    firstImage?.url ??
    firstImage?.image_url ??
    firstImage?.image_path ??
    firstImage?.path ??
    "";

  if (typeof image !== "string") {
    return "";
  }

  return image.trim();
};

/**
 * Resolve relative image paths against the API server.
 *
 * Examples:
 * /uploads/products/shirt.jpg
 * uploads/products/shirt.jpg
 * https://cdn.example.com/shirt.jpg
 */
const resolveImageUrl = (value) => {
  if (!value) return FALLBACK_IMAGE;

  const image = value.trim();

  if (!image) return FALLBACK_IMAGE;

  // Do not allow executable or unsupported URL schemes.
  if (/^(javascript|vbscript|file):/i.test(image)) {
    return FALLBACK_IMAGE;
  }

  // Absolute HTTP(S) URL.
  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  // Protocol-relative URL.
  if (image.startsWith("//")) {
    return `${window.location.protocol}${image}`;
  }

  // Data URLs: allow only common raster image formats.
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,/i.test(image)) {
    return image;
  }

  // Ignore other explicit schemes.
  if (/^[a-z][a-z\d+.-]*:/i.test(image)) {
    return FALLBACK_IMAGE;
  }

  // Root-relative or relative upload path.
  const path = image.replace(/^\.?\//, "");

  return `${API_BASE_URL}/${path}`;
};

const getPrice = (product) =>
  product?.new_price ??
  product?.base_price ??
  product?.best_price ??
  product?.price ??
  null;

const getOldPrice = (product) =>
  product?.old_price ??
  product?.compare_at_price ??
  product?.original_price ??
  null;

/* =========================================================
   Item component
========================================================= */

function Item({ p, badge, className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { has, toggle } = useWishList();

  const product = p;

  const productId = getProductId(product);
  const productName = getProductName(product);

  const imageUrl = useMemo(
    () => resolveImageUrl(getRawImage(product)),
    [product],
  );

  const priceValue = getPrice(product);
  const oldPriceValue = getOldPrice(product);

  const price = Number(priceValue);
  const oldPrice = Number(oldPriceValue);

  const validPrice =
    priceValue !== null &&
    priceValue !== undefined &&
    priceValue !== "" &&
    Number.isFinite(price) &&
    price >= 0;

  const hasDiscount =
    oldPriceValue !== null &&
    oldPriceValue !== undefined &&
    oldPriceValue !== "" &&
    Number.isFinite(oldPrice) &&
    oldPrice > price &&
    validPrice;

  const categoryName = getCategoryName(
    product?.category ?? product?.category_name,
  );

  const normalizedId =
    productId === null || productId === undefined
      ? ""
      : String(productId).trim();

  const liked = normalizedId ? Boolean(has(productId)) : false;

  const productUrl = normalizedId
    ? `/product/${encodeURIComponent(normalizedId)}`
    : "/new_arrivals";

  const handleWishlist = useCallback(() => {
    if (productId === null || productId === undefined) return;

    toggle(productId);
  }, [productId, toggle]);

  const handleImageError = useCallback(() => {
    setImageFailed(true);
  }, []);

  if (!product || typeof product !== "object") {
    return null;
  }

  return (
    <article
      className={`product_card${className ? ` ${className}` : ""}`}
      data-product-id={normalizedId || undefined}
    >
      <div className="product_photo">
        <NavLink
          to={productUrl}
          className="product_photo_link"
          aria-label={`View ${productName}`}
        >
          {imageUrl && !imageFailed ? (
            <img
              src={imageUrl}
              alt={productName}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          ) : (
            <span
              className="no_photo"
              role="img"
              aria-label={`Image unavailable for ${productName}`}
            >
              No photo
            </span>
          )}
        </NavLink>

        {badge && <span className="badge">{badge}</span>}

        <button
          type="button"
          className="wish_btn"
          aria-label={
            liked
              ? `Remove ${productName} from wishlist`
              : `Add ${productName} to wishlist`
          }
          aria-pressed={liked}
          disabled={!normalizedId}
          onClick={handleWishlist}
        >
          {liked ? (
            <FaHeart aria-hidden="true" />
          ) : (
            <FaRegHeart aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="product_info">
        <span className="product_cat">{categoryName}</span>

        <h3>
          <NavLink to={productUrl}>{productName}</NavLink>
        </h3>

        <p className="product_price">
          {formatPrice(priceValue)}

          {hasDiscount && (
            <span className="old_price">{formatPrice(oldPriceValue)}</span>
          )}
        </p>
      </div>
    </article>
  );
}

export default memo(Item);
