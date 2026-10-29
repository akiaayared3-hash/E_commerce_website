import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Item from "../component/Item/Item.jsx";
import { apiRequest } from "../lib/api.js";
import { list as listCategories } from "../lib/categoryApi.js";
import "./css/Categoty.css";

const PAGE_SIZE = 12; // products per page on screen
const FETCH_SIZE = 50; // the API maximum per request
const MAX_FETCH_PAGES = 20; // safety stop: at most 1000 products

// Common naming differences between category names and the slugs used in links.
const ALIASES = {
  clothes: ["clothing", "apparel"],
  clothing: ["clothes", "apparel"],
  shoes: ["shoe", "footwear"],
  footwear: ["shoes", "shoe"],
  t_shirt: ["tshirt", "tshirts", "t_shirts"],
  tshirt: ["t_shirt", "tshirts", "t_shirts"],
};

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

const unwrap = (response) => {
  const payload = response?.data ?? response;

  if (payload?.success === false) {
    throw new Error(payload.message || "Could not load products.");
  }

  return payload;
};

const getRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.products)) return payload.products;

  throw new Error("The server returned an unexpected products response.");
};

// The API returns products in pages, so read every page. Reading only the
// first page would hide products from any category that is not in it.
const fetchAllProducts = async (signal) => {
  const all = [];

  for (let page = 1; page <= MAX_FETCH_PAGES; page += 1) {
    const payload = unwrap(
      await apiRequest(`/api/products?page=${page}&limit=${FETCH_SIZE}`, {
        signal,
      }),
    );

    all.push(...getRows(payload));

    const totalPages = Number(payload?.total_pages) || 1;
    if (page >= totalPages) break;
  }

  return all;
};

// Product list items carry only category_id, so look the name up here.
const fetchCategoryMap = async () => {
  const rows = await listCategories();
  const map = new Map();

  for (const category of Array.isArray(rows) ? rows : []) {
    map.set(String(category.id), category);
  }

  return map;
};

const isHidden = (product) =>
  !product ||
  product.is_active === false ||
  product.is_active === 0 ||
  product.is_active === "0";

const normalizeProduct = (product, categories) => {
  const known = categories.get(String(product.category_id));

  const categoryName =
    product.category?.name ||
    product.category_name ||
    (typeof product.category === "string" ? product.category : "") ||
    known?.name ||
    "";

  const categorySlug =
    product.category?.slug || product.category_slug || known?.slug || "";

  return {
    ...product,
    id: product.id ?? product.product_id ?? product.slug,
    name: product.name ?? product.title ?? "Untitled product",
    image:
      product.image ??
      product.image_url ??
      product.images?.[0]?.url ??
      product.images?.[0]?.image_url ??
      "",
    category: categoryName,
    category_slug: categorySlug,
    new_price:
      product.new_price ??
      product.base_price ??
      product.best_price ??
      product.price ??
      0,
    old_price: product.old_price ?? product.compare_at_price ?? 0,
  };
};

const matchesCategory = (product, categoryKey) => {
  const candidates = [product.category_slug, product.category]
    .map(normalizeText)
    .filter(Boolean);

  const accepted = [categoryKey, ...(ALIASES[categoryKey] ?? [])];

  return candidates.some((candidate) => accepted.includes(candidate));
};

const Category = ({ title = "Our Collection", category }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const categoryKey = normalizeText(category);

  const loadProducts = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");

      try {
        const [rows, categories] = await Promise.all([
          fetchAllProducts(signal),
          fetchCategoryMap().catch((err) => {
            // Without categories, a category page cannot filter. A page that
            // shows every product still works.
            if (categoryKey) throw err;
            return new Map();
          }),
        ]);

        if (signal.aborted) return;

        setProducts(
          rows
            .filter((product) => !isHidden(product))
            .map((product) => normalizeProduct(product, categories)),
        );
      } catch (err) {
        if (signal.aborted) return;

        if (import.meta.env.DEV) {
          console.error("Category page load failed:", err);
        }

        setError(
          err instanceof Error ? err.message : "Unable to load products.",
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [categoryKey],
  );

  useEffect(() => {
    const controller = new AbortController();

    loadProducts(controller.signal);

    return () => controller.abort();
  }, [loadProducts, retryKey]);

  const visibleProducts = useMemo(() => {
    if (!categoryKey) return products;

    return products.filter((product) => matchesCategory(product, categoryKey));
  }, [products, categoryKey]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PAGE_SIZE));

  const pageProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleProducts.slice(start, start + PAGE_SIZE);
  }, [visibleProducts, page]);

  useEffect(() => {
    setPage(1);
  }, [categoryKey]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <main className="category_page">
      <header className="category_header">
        <span className="category_eyebrow">MULE FASHION BOUTIQUE</span>
        <h1>{title}</h1>
        <p>
          {loading
            ? "Finding pieces for you…"
            : `${visibleProducts.length} ${
                visibleProducts.length === 1 ? "product" : "products"
              }`}
        </p>
      </header>

      {loading && (
        <div className="category_status" role="status" aria-live="polite">
          <span className="category_spinner" aria-hidden="true" />
          Loading products…
        </div>
      )}

      {!loading && error && (
        <section className="category_message" role="alert">
          <h2>We couldn't load the collection</h2>
          <p>{error}</p>
          <button
            type="button"
            className="category_retry"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            Try again
          </button>
        </section>
      )}

      {!loading && !error && visibleProducts.length === 0 && (
        <section className="category_message">
          <h2>No products available yet</h2>
          <p>We're preparing this collection. Please check back soon.</p>
          <Link to="/" className="category_home_link">
            Explore homepage
          </Link>
        </section>
      )}

      {!loading && !error && visibleProducts.length > 0 && (
        <>
          <div className="product_grid">
            {pageProducts.map((product) => (
              <Item key={product.id} p={product} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="category_pagination" aria-label="Product pages">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                Previous
              </button>

              <span aria-live="polite">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page === totalPages}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
};

export default Category;
