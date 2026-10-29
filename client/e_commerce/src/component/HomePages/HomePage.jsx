import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa";
import { categories as bannerProducts } from "../../component/Assets/product.js";
import Item from "../Item/Item.jsx";
import { apiRequest } from "../../lib/api.js";
import "./HomePage.css";

const REQUEST_TIMEOUT_MS = 15000;
const PRODUCT_LIMIT = 4;

const categoryTiles = [
  {
    name: "Clothes",
    key: "clothes",
    aliases: ["clothes", "clothing", "apparel"],
    to: "/clothes",
    coverId: 4,
    blurb: "Jackets, hoodies and full outfits",
  },
  {
    name: "Shoes",
    key: "shoes",
    aliases: ["shoes", "shoe", "footwear", "sneakers"],
    to: "/shoes",
    coverId: 18,
    blurb: "Sneakers and sport shoes",
  },
  {
    name: "T-Shirts",
    key: "t_shirt",
    aliases: ["t_shirt", "t-shirt", "tshirt", "t-shirts"],
    to: "/t_shirt",
    coverId: 25,
    blurb: "Everyday comfort",
  },
];

const perks = [
  { title: "Premium quality", text: "Carefully chosen clothing and shoes." },
  { title: "Delivery in Ethiopia", text: "Delivery to your door." },
  { title: "Easy returns", text: "Clear and simple return policy." },
  { title: "Local payments", text: "Telebirr, CBE Birr, Cash on Delivery." },
];

const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

function normalizeProduct(product) {
  const rawPrice =
    product.base_price ??
    product.best_price ??
    product.new_price ??
    product.price;

  const price = Number(rawPrice);
  const rawOldPrice = product.old_price ?? product.compare_at_price;
  const oldPrice =
    rawOldPrice == null || rawOldPrice === "" ? 0 : Number(rawOldPrice);

  const rawImage =
    product.image ??
    product.image_url ??
    product.images?.[0]?.url ??
    product.images?.[0]?.image_url ??
    "";

  const categoryValue =
    product.category?.slug ??
    product.category?.name ??
    product.category_slug ??
    product.category_name ??
    product.category_key ??
    product.category ??
    "";

  const active =
    product.is_active !== false &&
    product.is_active !== 0 &&
    product.is_active !== "0";

  return {
    ...product,
    id: product.id ?? product.product_id ?? product.slug,
    name: product.name ?? product.title ?? "Untitled product",
    image: typeof rawImage === "string" ? rawImage : "",
    new_price: Number.isFinite(price) ? price : null,
    old_price: Number.isFinite(oldPrice) ? oldPrice : 0,
    category: normalizeText(categoryValue),
    isNew: Boolean(product.isNew ?? product.is_new),
    is_active: active,
  };
}

function getDiscount(product) {
  if (
    product.old_price > 0 &&
    product.new_price != null &&
    product.old_price > product.new_price
  ) {
    return Math.round(
      ((product.old_price - product.new_price) / product.old_price) * 100,
    );
  }

  return 0;
}

function getProductRows(payload) {
  const data = payload?.data ?? payload;

  if (data?.success === false) {
    throw new Error(data.message || "The server could not load products.");
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.products)) return data.products;

  throw new Error(
    "The products API returned an unexpected response. Check GET /api/products.",
  );
}

function getBannerProduct(id) {
  return bannerProducts.find((product) => Number(product.id) === id);
}

function ProductSkeleton() {
  return (
    <div
      className="product_grid"
      aria-label="Loading products"
      aria-busy="true"
    >
      {Array.from({ length: PRODUCT_LIMIT }, (_, index) => (
        <div className="product_loading" key={index}>
          <div className="product_loading_image" />
          <div className="product_loading_line" />
          <div className="product_loading_line short" />
        </div>
      ))}
    </div>
  );
}

function ProductSection({
  eyebrow,
  title,
  to,
  products,
  badge,
  linkLabel = "View all",
}) {
  if (!products.length) return null;

  return (
    <section className="section">
      <div className="section_head row">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>

        <NavLink to={to} className="view_all">
          {linkLabel} <FaArrowRight aria-hidden="true" />
        </NavLink>
      </div>

      <div className="product_grid">
        {products.map((product) => (
          <Item
            key={product.id}
            p={product}
            badge={badge ? badge(product) : null}
          />
        ))}
      </div>
    </section>
  );
}

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    async function loadProducts() {
      setLoading(true);
      setError("");

      try {
        const payload = await apiRequest("/api/products", {
          signal: controller.signal,
        });

        const rows = getProductRows(payload);

        const normalized = rows
          .filter((product) => product && product.is_active !== false)
          .map(normalizeProduct)
          .filter((product) => product.id != null);

        if (!controller.signal.aborted) {
          setProducts(normalized);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          if (timedOut) {
            setError("Loading products took too long. Please try again.");
          } else {
            return;
          }
        } else {
          setError(
            err?.message || "We couldn't load products. Please try again.",
          );
        }
      } finally {
        window.clearTimeout(timeoutId);

        if (!controller.signal.aborted || timedOut) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [reloadKey]);

  const newArrivals = useMemo(() => {
    const marked = products.filter((product) => product.isNew);

    // The API returns newest products first, so preserve its order.
    return (marked.length ? marked : products).slice(0, PRODUCT_LIMIT);
  }, [products]);

  const deals = useMemo(
    () =>
      products
        .filter((product) => getDiscount(product) > 0)
        .sort((a, b) => getDiscount(b) - getDiscount(a))
        .slice(0, PRODUCT_LIMIT),
    [products],
  );

  const tshirts = useMemo(
    () =>
      products
        .filter((product) =>
          categoryTiles
            .find((category) => category.key === "t_shirt")
            .aliases.includes(product.category),
        )
        .slice(0, PRODUCT_LIMIT),
    [products],
  );

  const hero = getBannerProduct(7);
  const editorial = getBannerProduct(20);

  const getCategoryCount = (category) =>
    products.filter((product) => category.aliases.includes(product.category))
      .length;

  return (
    <main className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero_text">
          <p className="eyebrow">New collection</p>
          <h1>Dress with quiet confidence.</h1>
          <p className="hero_lead">
            Discover quality clothing and shoes selected for your style.
          </p>

          <div className="hero_actions">
            <NavLink to="/new_arrivals" className="btn btn_primary">
              Shop New Arrivals
            </NavLink>
            <NavLink to="/shoes" className="btn btn_outline">
              Explore Shoes
            </NavLink>
          </div>

          <p className="hero_pay">
            Pay with Telebirr, CBE Birr or Cash on Delivery
          </p>
        </div>

        <div className="hero_media_wrap">
          <div className="hero_media">
            {hero?.image ? (
              <img
                src={hero.image}
                alt="Featured outfit"
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              <div className="hero_media_placeholder">
                Discover the new collection
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="perks_band">
        <ul className="perks">
          {perks.map((perk) => (
            <li key={perk.title}>
              <strong>{perk.title}</strong>
              <span>{perk.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="section_head center">
          <p className="eyebrow">Shop by category</p>
          <h2>Find your style</h2>
        </div>

        <div className="cat_grid">
          {categoryTiles.map((category) => {
            const cover = getBannerProduct(category.coverId);
            const count = getCategoryCount(category);

            return (
              <NavLink key={category.key} to={category.to} className="cat_tile">
                {cover?.image && (
                  <img
                    src={cover.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}

                <span className="cat_overlay" />
                <span className="cat_content">
                  <span className="cat_count">
                    {count > 0 ? `${count} products` : "Explore collection"}
                  </span>
                  <span className="cat_name">{category.name}</span>
                  <span className="cat_blurb">{category.blurb}</span>
                  <span className="cat_cta">
                    Shop now <FaArrowRight aria-hidden="true" />
                  </span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </section>

      {/* New arrivals */}
      <section className="section">
        <div className="section_head row">
          <div>
            <p className="eyebrow">Just in</p>
            <h2>New arrivals</h2>
          </div>

          <NavLink to="/new_arrivals" className="view_all">
            View all <FaArrowRight aria-hidden="true" />
          </NavLink>
        </div>

        {loading ? (
          <ProductSkeleton />
        ) : error ? (
          <div className="product_error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn_primary" onClick={retry}>
              Try again
            </button>
          </div>
        ) : newArrivals.length ? (
          <div className="product_grid">
            {newArrivals.map((product) => (
              <Item key={product.id} p={product} badge="New" />
            ))}
          </div>
        ) : (
          <p className="product_empty">Products are coming soon.</p>
        )}
      </section>

      {/* Editorial banner: decorative images remain separate from database products */}
      {editorial?.image && (
        <section className="section">
          <div className="editorial">
            <div className="editorial_text">
              <p className="eyebrow gold">The shoe edit</p>
              <h2>Shoes made to be worn, and worn again.</h2>
              <p>
                Discover footwear chosen for comfort, craft and a finish that
                lasts.
              </p>
              <NavLink to="/shoes" className="btn btn_primary">
                Shop Shoes
              </NavLink>
            </div>

            <div className="editorial_media">
              <img
                src={editorial.image}
                alt="Featured footwear"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>
      )}

      {/* Deals */}
      {!loading && !error && (
        <ProductSection
          eyebrow="Best prices"
          title="Top deals"
          to="/new_arrivals"
          linkLabel="See more"
          products={deals}
          badge={(product) => `-${getDiscount(product)}%`}
        />
      )}

      {/* T-shirts */}
      {!loading && !error && (
        <ProductSection
          eyebrow="Everyday wear"
          title="T-shirt collection"
          to="/t_shirt"
          products={tshirts}
        />
      )}

      {/* Closing call to action */}
      <section className="section last">
        <div className="cta_band">
          <div>
            <h2>Need help choosing your size?</h2>
            <p>Message us and we'll help you find the right fit.</p>
          </div>
          <NavLink to="/contacts" className="btn btn_primary">
            Contact Us
          </NavLink>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
