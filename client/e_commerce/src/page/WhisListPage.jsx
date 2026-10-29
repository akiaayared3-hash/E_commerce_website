import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaRegHeart, FaArrowLeft, FaTrashAlt, FaSyncAlt } from "react-icons/fa";

import Item from "../../src/component/Item/Item.jsx";
import { useWishList } from "./WishList.jsx";
import { apiRequest } from "../../src/lib/api.js";
import "./css/WishListPage.css";

const PRODUCTS_ENDPOINT = "/api/products";

/* Helpers */

const normalizeId = (id) =>
  id === null || id === undefined ? "" : String(id).trim();

const getProductId = (product) =>
  product?.id ?? product?.product_id ?? product?.productId ?? null;

const getProductArray = (response) => {
  if (Array.isArray(response)) return response;

  const candidates = [
    response?.items, // Actual API response
    response?.products,
    response?.data?.items,
    response?.data?.products,
    response?.data?.data?.items,
    response?.data?.data?.products,
    response?.data,
    response?.results,
  ];

  return candidates.find(Array.isArray) ?? [];
};

/* Wishlist page */

export default function WishlistPage() {
  const { ids = [], toggle, clear } = useWishList();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const loadProducts = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest(PRODUCTS_ENDPOINT, {
        method: "GET",
        signal,
      });

      if (signal?.aborted) return;

      const result = getProductArray(response);

      if (!Array.isArray(result)) {
        throw new Error("The server returned an invalid product response.");
      }

      setProducts(result);
    } catch (err) {
      if (signal?.aborted) return;

      setProducts([]);
      setError(
        err?.message || "We couldn't load your products. Please try again.",
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadProducts(controller.signal);

    return () => controller.abort();
  }, [loadProducts, retryKey]);

  const wishlistProducts = useMemo(() => {
    const productMap = new Map();

    for (const product of products) {
      const id = normalizeId(getProductId(product));

      if (id) {
        productMap.set(id, product);
      }
    }

    return [...ids]
      .map((id) => productMap.get(normalizeId(id)))
      .filter(Boolean)
      .reverse();
  }, [ids, products]);

  const unavailableCount = Math.max(0, ids.length - wishlistProducts.length);

  const handleRemove = useCallback((id) => toggle(id), [toggle]);

  const handleClear = useCallback(() => {
    clear();
    setConfirmClear(false);
  }, [clear]);

  const handleRetry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  return (
    <main className="wl_page">
      <div className="wl_container">
        <nav className="wl_breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Wishlist</span>
        </nav>

        <header className="wl_head">
          <div className="wl_title_group">
            <span className="wl_eyebrow">YOUR PERSONAL COLLECTION</span>

            <h1>
              My Wishlist <FaRegHeart aria-hidden="true" />
            </h1>

            <p className="wl_subtitle">
              Keep the pieces you love close at hand.
            </p>
          </div>

          <div className="wl_head_actions">
            <span className="wl_count" aria-live="polite">
              {ids.length} {ids.length === 1 ? "item" : "items"}
            </span>

            {ids.length > 0 && !confirmClear && (
              <button
                type="button"
                className="wl_clear"
                onClick={() => setConfirmClear(true)}
              >
                <FaTrashAlt aria-hidden="true" />
                Clear wishlist
              </button>
            )}

            {confirmClear && (
              <div className="wl_clear_confirm">
                <span>Remove all saved items?</span>

                <button
                  type="button"
                  className="wl_clear wl_clear--danger"
                  onClick={handleClear}
                >
                  Yes, clear
                </button>

                <button
                  type="button"
                  className="wl_cancel"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </header>

        {loading && (
          <section className="wl_status" aria-live="polite">
            <span className="wl_spinner" aria-hidden="true" />
            <p>Loading your saved pieces...</p>
          </section>
        )}

        {!loading && error && (
          <section className="wl_status wl_status--error" role="alert">
            <h2>Unable to load your wishlist</h2>
            <p>{error}</p>

            <button type="button" className="wl_btn" onClick={handleRetry}>
              <FaSyncAlt aria-hidden="true" />
              Try again
            </button>
          </section>
        )}

        {!loading && !error && ids.length === 0 && (
          <section className="wl_empty">
            <div className="wl_empty_icon">
              <FaRegHeart aria-hidden="true" />
            </div>

            <span className="wl_eyebrow">NOTHING SAVED YET</span>

            <h2>Your next favorite is waiting.</h2>

            <p>
              Browse the collection and save the pieces you love. They’ll be
              waiting here when you return.
            </p>

            <Link to="/new_arrivals" className="wl_btn">
              Explore the collection
              <FaArrowLeft className="wl_btn_arrow" aria-hidden="true" />
            </Link>
          </section>
        )}

        {!loading && !error && ids.length > 0 && (
          <>
            {unavailableCount > 0 && (
              <p className="wl_notice" role="status">
                {unavailableCount} saved{" "}
                {unavailableCount === 1 ? "item isn't" : "items aren't"} in the
                products currently returned by the server. The product list may
                be paginated, or some saved products may no longer exist.
              </p>
            )}

            {wishlistProducts.length > 0 ? (
              <section
                className="wl_products"
                aria-labelledby="wl-products-title"
              >
                <div className="wl_products_head">
                  <h2 id="wl-products-title">Saved for later</h2>

                  <span>
                    {wishlistProducts.length}{" "}
                    {wishlistProducts.length === 1 ? "product" : "products"}
                  </span>
                </div>

                <div className="product_grid wl_product_grid">
                  {wishlistProducts.map((product) => {
                    const id = getProductId(product);
                    const key = normalizeId(id);
                    const name =
                      product.name ?? product.product_name ?? "Product";

                    return (
                      <article className="wl_product_card" key={key}>
                        <Item p={product} />

                        <button
                          type="button"
                          className="wl_remove_item"
                          onClick={() => handleRemove(id)}
                          aria-label={`Remove ${name} from wishlist`}
                          title="Remove from wishlist"
                        >
                          <FaTrashAlt aria-hidden="true" />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="wl_status">
                <h2>Your saved products aren't available</h2>

                <p>
                  Your saved IDs did not match the products returned by the API.
                  Check the product IDs and pagination.
                </p>

                <button type="button" className="wl_btn" onClick={handleRetry}>
                  <FaSyncAlt aria-hidden="true" />
                  Reload products
                </button>

                <Link to="/new_arrivals" className="wl_btn">
                  Browse products
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
