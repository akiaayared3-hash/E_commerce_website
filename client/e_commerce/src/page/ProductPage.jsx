import { useCallback, useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import ProductDisplay from "../component/ProductDisplay/ProductDisplay";
import { apiRequest } from "../lib/api.js";
import "./css/ProductPage.css";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const unwrapProduct = (response) => {
  let body = response?.data ?? response;

  // Support common API response formats:
  // { product: {...} }, { data: { product: {...} } },
  // { data: {...} }, or the product object itself.
  for (let i = 0; i < 4 && isRecord(body); i += 1) {
    if (isRecord(body.product)) {
      body = body.product;
      continue;
    }

    if (isRecord(body.data)) {
      body = body.data;
      continue;
    }

    if (isRecord(body.item)) {
      body = body.item;
      continue;
    }

    break;
  }

  return isRecord(body) && body.id != null ? body : null;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "active"].includes(normalized)) return true;
    if (["false", "0", "inactive"].includes(normalized)) return false;
  }

  return null;
};

const normalizePrice = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const price = Number(value);

  return Number.isFinite(price) && price >= 0 ? price : null;
};

const normalizeVariant = (variant) => {
  if (!isRecord(variant)) return null;

  const stockValue =
    variant.stock_quantity ??
    variant.stock ??
    variant.quantity ??
    variant.inventory?.quantity;

  const parsedStock =
    stockValue === null ||
    stockValue === undefined ||
    String(stockValue).trim() === ""
      ? 0
      : Number(stockValue);

  const stock =
    Number.isSafeInteger(parsedStock) && parsedStock >= 0 ? parsedStock : 0;

  const active = parseBoolean(variant.is_active);

  return {
    ...variant,
    id: variant.id ?? null,
    sku: String(variant.sku ?? ""),
    size: String(variant.size ?? variant.attributes?.size ?? ""),
    color: String(variant.color ?? variant.attributes?.color ?? ""),
    price: normalizePrice(variant.price),
    stock,
    in_stock: stock > 0 && active !== false,
  };
};

const mapProduct = (product) => {
  const variants = Array.isArray(product.variants)
    ? product.variants.map(normalizeVariant).filter(Boolean)
    : [];

  const variantPrices = variants
    .map((variant) => variant.price)
    .filter((price) => price !== null);

  const basePrice = normalizePrice(product.base_price ?? product.best_price);

  const category =
    typeof product.category === "string"
      ? product.category
      : (product.category?.name ?? "");

  const image =
    typeof product.image === "string"
      ? product.image
      : (product.image?.url ?? "");

  const images = Array.isArray(product.images)
    ? product.images
        .map((item) => (typeof item === "string" ? item : (item?.url ?? "")))
        .filter(Boolean)
    : [];

  const active = parseBoolean(product.is_active);

  return {
    ...product,
    name: String(product.name ?? "").trim(),
    description: String(product.description ?? "").trim(),
    category,
    image: image || images[0] || "",
    images,
    variants,
    new_price:
      variantPrices.length > 0 ? Math.min(...variantPrices) : basePrice,
    old_price: normalizePrice(product.old_price),
    is_active: active ?? true,
  };
};

const isNotFoundError = (error) =>
  error?.status === 404 ||
  error?.statusCode === 404 ||
  /\b404\b|not found/i.test(error?.message ?? "");

const ProductPage = () => {
  const { id, productId, slug } = useParams();
  const key = id ?? productId ?? slug;

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProduct = async () => {
      setProduct(null);
      setStatus("loading");

      if (key == null || String(key).trim() === "") {
        setStatus("notfound");
        return;
      }

      const value = String(key).trim();

      const path = /^\d+$/.test(value)
        ? `/api/products/${encodeURIComponent(value)}`
        : `/api/products/slug/${encodeURIComponent(value)}`;

      try {
        const response = await apiRequest(path);

        if (cancelled) return;

        const rawProduct = unwrapProduct(response);

        if (
          !rawProduct ||
          parseBoolean(rawProduct.is_active) === false ||
          ["inactive", "disabled", "draft", "archived"].includes(
            String(rawProduct.status ?? "").toLowerCase(),
          )
        ) {
          setStatus("notfound");
          return;
        }

        const normalized = mapProduct(rawProduct);

        if (!normalized.name) {
          throw new Error("The API returned a product without a name.");
        }

        setProduct(normalized);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;

        if (import.meta.env.DEV) {
          console.error("Failed to load product:", error);
        }

        setStatus(isNotFoundError(error) ? "notfound" : "error");
      }
    };

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [key, retryCount]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [key]);

  useEffect(() => {
    const previousTitle = document.title;

    document.title = product?.name
      ? `${product.name} | Mule Fashion Boutique`
      : "Shop | Mule Fashion Boutique";

    return () => {
      document.title = previousTitle;
    };
  }, [product?.name]);

  if (status === "loading") {
    return (
      <main className="product-page-state" aria-busy="true">
        <span className="product-page-spinner" aria-hidden="true" />
        <h1>Loading product</h1>
        <p>Please wait while we load the product details.</p>
      </main>
    );
  }

  if (status === "notfound") {
    return (
      <main className="product-page-state">
        <h1>Product unavailable</h1>
        <p>This product may have been removed or is no longer available.</p>
        <NavLink className="product-page-button" to="/">
          Continue shopping
        </NavLink>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="product-page-state" role="alert">
        <h1>We couldn’t load this product</h1>
        <p>
          Check your connection and try again. Your shopping cart and the rest
          of the website do not need to be reloaded.
        </p>
        <button className="product-page-button" type="button" onClick={retry}>
          Try again
        </button>
        <NavLink to="/" className="product-page-link">
          Back to shop
        </NavLink>
      </main>
    );
  }

  return (
    <main className="product-page">
      <ProductDisplay product={product} />
    </main>
  );
};

export default ProductPage;
