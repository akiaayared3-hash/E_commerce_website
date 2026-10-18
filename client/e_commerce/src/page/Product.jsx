import React, { useEffect } from "react";
import { useParams, NavLink } from "react-router-dom";
import { categories as products } from "../component/Assets/product.js";
import BreadCrams from "../component/BreadCrams/BreadCrams.jsx";
import ProductDisplay from "../component/ProductDisplay/ProductDisplay";
import RelatedProducts from "../component/RelatedProducts/RelatedProducts";
import "./css/Product.css";

const Product = () => {
  const { productId } = useParams();
  const product = products.find((p) => p.id === Number(productId));

  // when a related product is clicked, start at the top of the new page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [productId]);

  if (!product) {
    return (
      <main className="pd_page">
        <h1>Product not found</h1>
        <NavLink to="/">Back to home</NavLink>
      </main>
    );
  }

  return (
    <main className="pd_page">
      <BreadCrams product={product} />
      <ProductDisplay product={product} />
      <RelatedProducts
        currentCategory={product.category}
        currentProductId={product.id}
      />
    </main>
  );
};

export default Product;
