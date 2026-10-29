import React, { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api.js";
import Item from "../Item/Item.jsx";
import "./RelatedProducts.css";

const MAX_ITEMS = 4;

// Fill in your real ids: SELECT id, name FROM categories;
const CATEGORY_BY_ID = {
  1: "clothes",
  2: "shoes",
  3: "t_shirt",
};

const mapProduct = (p) => ({
  ...p,
  new_price: Number(p.base_price) || 0,
  old_price: Number(p.old_price) || 0,
  category: p.category || CATEGORY_BY_ID[p.category_id] || "",
  variants: Array.isArray(p.variants) ? p.variants : [],
});

const RelatedProducts = ({ currentCategory, currentProductId }) => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;

    apiRequest("/api/products?limit=20")
      .then((res) => {
        if (cancelled) return;
        setProducts((res?.items ?? []).map(mapProduct));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const others = products.filter((p) => p.id !== currentProductId);
  const sameCategory = others.filter((p) => p.category === currentCategory);
  const rest = others.filter((p) => p.category !== currentCategory);
  const related = [...sameCategory, ...rest].slice(0, MAX_ITEMS);

  if (related.length === 0) return null;

  return (
    <section className="related">
      <h2 className="related_title">You may also like</h2>
      <div className="related_grid">
        {related.map((item) => (
          <Item key={item.id} p={item} />
        ))}
      </div>
    </section>
  );
};

export default RelatedProducts;
