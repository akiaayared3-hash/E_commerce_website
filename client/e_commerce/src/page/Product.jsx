import { useCallback, useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import BreadCrams from "../component/BreadCrams/BreadCrams.jsx";
import ProductDisplay from "../component/ProductDisplay/ProductDisplay";
import RelatedProducts from "../component/RelatedProducts/RelatedProducts";
import { apiRequest } from "../lib/api.js";
import "./css/Product.css";

const STORE_NAME = "Mule Fashion Boutique";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const unwrapProduct = (response) => {
  let body = response?.data ?? response;

  // Support common API response envelopes without accepting arrays.
  for (let i = 0; i < 3 && isRecord(body); i += 1) {
    if (body.product && isRecord(body.product)) {
      body = body.product;
      continue;
    }

    if (body.data && isRecord(body.data)) {
      body = body.data;
      continue;
    }

    if (body.item && isRecord(body.item)) {
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

const isInactive = (product) => {
  const active = parseBoolean(product.is_active);

  if (active !== null) return !active;

  const status = String(product.status ?? "")
    .trim()
    .toLowerCase();

  return ["inactive", "disabled", "draft", "archived"].includes(status);
};

const isNotFoundError = (error) =>
  error?.status === 404 ||
  error?.statusCode === 404 ||
  /\b404\b|not found/i.test(error?.message ?? "");

const normalizeImage = (image) => {
  if (typeof image === "string") return image;

  if (isRecord(image)) {
    return typeof image.url === "string" ? image.url : "";
  }

  return "";
};

const normalizeVariant = (variant) => {
  if (!isRecord(variant)) return null;

  const rawPrice = variant.price;
  const price =
    rawPrice !== null &&
    rawPrice !== undefined &&
    String(rawPrice).trim() !== ""
      ? Number(rawPrice)
      : null;

  const rawStock =
    variant.stock ??
    variant.stock_quantity ??
    variant.quantity ??
    variant.inventory?.quantity;

  const parsedStock =
    rawStock !== null &&
    rawStock !== undefined &&
    String(rawStock).trim() !== ""
      ? Number(rawStock)
      : null;

  const stock =
    parsedStock !== null &&
    Number.isSafeInteger(parsedStock) &&
    parsedStock >= 0
      ? parsedStock
      : 0;

  return {
    ...variant,
    id: variant.id ?? null,
    sku: String(variant.sku ?? ""),
    size: String(variant.size ?? variant.attributes?.size ?? ""),
    color: String(variant.color ?? variant.attributes?.color ?? ""),
    price:
      price !== null && Number.isFinite(price) && price >= 0 ? price : null,
    stock,
    in_stock: stock > 0 && variant.is_active !== false,
  };
};

const mapProduct = (product) => {
  const variants = Array.isArray(product.variants)
    ? product.variants.map(normalizeVariant).filter(Boolean)
    : [];

  const validPrices = variants
    .map((variant) => variant.price)
    .filter((price) => price !== null);

  const basePrice = Number(product.base_price ?? product.best_price);

  const normalizedBasePrice =
    Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : null;

  const imageList = Array.isArray(product.images)
    ? product.images.map(normalizeImage).filter(Boolean)
    : [];

  const primaryImage = normalizeImage(product.image);

  const categoryName =
    (typeof product.category === "string" && product.category) ||
    (isRecord(product.category) && product.category.name) ||
    "";

  const categorySlug = isRecord(product.category)
    ? (product.category.slug ?? "")
    : (product.category_slug ?? "");

  const active = parseBoolean(product.is_active);

  return {
    ...product,
    id: product.id,
    name: String(product.name ?? "").trim(),
    description: String(product.description ?? "").trim(),
    image: primaryImage || imageList[0] || "",
    images: imageList,
    category: categoryName,
    category_slug: categorySlug,
    category_id: product.category_id ?? product.category?.id ?? null,
    new_price:
      validPrices.length > 0 ? Math.min(...validPrices) : normalizedBasePrice,
    old_price: Number.isFinite(Number(product.old_price))
      ? Number(product.old_price)
      : null,
    variants,
    is_active: active ?? true,
    status: product.status ?? (active === false ? "inactive" : "active"),
  };
};

const Product = () => {
  const { productId, id, slug } = useParams();
  const key = productId ?? id ?? slug;

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

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
        const response = await apiRequest(path, {
          signal: controller.signal,
        });

        if (cancelled) return;

        const rawProduct = unwrapProduct(response);

        if (!rawProduct || isInactive(rawProduct)) {
          setStatus("notfound");
          return;
        }

        const normalized = mapProduct(rawProduct);

        if (!normalized.name) {
          throw new Error("The product response is missing its name.");
        }

        setProduct(normalized);
        setStatus("ready");
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;

        if (isNotFoundError(error)) {
          setStatus("notfound");
          return;
        }

        if (import.meta.env.DEV) {
          console.error("Failed to load product:", error);
        }

        setStatus("error");
      }
    };

    loadProduct();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, attempt]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [key]);

  useEffect(() => {
    const previousTitle = document.title;

    document.title = product?.name
      ? `${product.name} | ${STORE_NAME}`
      : `Shop | ${STORE_NAME}`;

    return () => {
      document.title = previousTitle;
    };
  }, [product?.name]);

  if (status === "loading") {
    return (
      <main className="pd_page" aria-busy="true">
        <section className="pd_state" role="status" aria-live="polite">
          <span className="pd_spinner" aria-hidden="true" />
          <h1>Loading product</h1>
          <p>Please wait while we retrieve the product details.</p>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="pd_page">
        <section className="pd_state" role="alert">
          <h1>We couldn’t load this product</h1>
          <p>
            Check your internet connection and try again. Your shopping
            experience should be simple, not frustrating.
          </p>
          <div className="pd_state_actions">
            <button
              type="button"
              className="pd_button pd_button--primary"
              onClick={retry}
            >
              Try again
            </button>
            <NavLink to="/" className="pd_button pd_button--secondary">
              Back to shop
            </NavLink>
          </div>
        </section>
      </main>
    );
  }

  if (status === "notfound" || !product) {
    return (
      <main className="pd_page">
        <section className="pd_state">
          <h1>Product unavailable</h1>
          <p>
            This product may have been removed or is no longer available.
            Explore our shop to discover other items.
          </p>
          <NavLink to="/" className="pd_button pd_button--primary">
            Continue shopping
          </NavLink>
        </section>
      </main>
    );
  }

  return (
    <main className="pd_page">
      <div className="pd_container">
        <BreadCrams product={product} />

        <ProductDisplay product={product} />

        <RelatedProducts
          currentCategory={product.category}
          currentProductId={product.id}
        />
      </div>
    </main>
  );
};

export default Product;
