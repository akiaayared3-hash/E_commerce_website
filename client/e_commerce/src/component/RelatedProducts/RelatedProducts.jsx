import React, { useMemo } from "react";
import { categories as products } from "../Assets/product.js";
import Item from "../Item/Item.jsx";
import "./RelatedProducts.css";

const MAX_ITEMS = 4;

const RelatedProducts = ({ currentCategory, currentProductId }) => {
  const related = useMemo(() => {
    const others = products.filter((p) => p.id !== currentProductId);
    const sameCategory = others.filter((p) => p.category === currentCategory);
    const rest = others.filter((p) => p.category !== currentCategory);
    return [...sameCategory, ...rest].slice(0, MAX_ITEMS);
  }, [currentCategory, currentProductId]);

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
