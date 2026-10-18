import React from "react";
import { NavLink } from "react-router-dom";
import { FaRegHeart } from "react-icons/fa";
import { categories as products } from "../../src/component/Assets/product.js";
import Item from "../../src/component/Item/Item.jsx";
import { useWishList } from "../../src/page/WishList.jsx";
import "./css/WishListPage.css";

const WishlistPage = () => {
  const { ids, clear } = useWishList();

  // newest first, and skip any id that no longer exists in your data
  const items = [...ids]
    .reverse()
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <main className="wl_page">
      <header className="wl_head">
        <div>
          <p className="wl_eyebrow">Your favourites</p>
          <h1>Wishlist</h1>
          <p className="wl_count">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        {items.length > 0 && (
          <button type="button" className="wl_clear" onClick={clear}>
            Clear all
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="wl_empty">
          <span className="wl_empty_icon" aria-hidden="true">
            <FaRegHeart />
          </span>
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on any product to save it here.</p>
          <NavLink to="/new_arrivals" className="wl_btn">
            Browse new arrivals
          </NavLink>
        </div>
      ) : (
        <div className="product_grid">
          {items.map((p) => (
            <Item key={p.id} p={p} />
          ))}
        </div>
      )}
    </main>
  );
};

export default WishlistPage;
