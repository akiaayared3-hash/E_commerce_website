import React from "react";
import Item from "../component/Item/Item.jsx";
import { categories as products } from "../component/Assets/product.js";

const Category = ({ title, category }) => {
  const list = category
    ? products.filter((p) => p.category === category)
    : products;

  return (
    <main
      style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 40px 96px" }}
    >
      <h1
        style={{ fontFamily: "Bodoni Moda, Georgia, serif", fontWeight: 400 }}
      >
        {title}
      </h1>
      <p style={{ color: "#5c5c5c", marginBottom: 32 }}>
        {list.length} products
      </p>
      <div className="product_grid">
        {list.map((p) => (
          <Item key={p.id} p={p} />
        ))}
      </div>
    </main>
  );
};

export default Category;
