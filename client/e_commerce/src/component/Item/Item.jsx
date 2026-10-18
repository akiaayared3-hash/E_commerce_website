import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { FaRegHeart, FaHeart } from "react-icons/fa";
import { useWishList } from "../../page/WishList";
import "./Item.css";

const formatPrice = (p) => (p ? `ETB ${p.toLocaleString()}` : "ETB --");

const Item = ({ p, badge }) => {
  const { has, toggle } = useWishList();
  const liked = has(p.id);
  const hasDiscount = p.old_price > p.new_price;
  const link = `/product/${p.id}`;

  return (
    <article className="product_card">
      <div className="product_photo">
        <NavLink to={link} className="product_photo_link" aria-label={p.name}>
          {p.image ? (
            <img src={p.image} alt={p.name} loading="lazy" />
          ) : (
            <span className="no_photo">No photo</span>
          )}
        </NavLink>

        {badge && <span className="badge">{badge}</span>}

        <button
          type="button"
          className="wish_btn"
          aria-label={`Add ${p.name} to wishlist`}
          onClick={() => toggle(p.id)}
        >
          {liked ? <FaHeart /> : <FaRegHeart />}
        </button>
      </div>

      <div className="product_info">
        <span className="product_cat">{p.category.replace("_", "-")}</span>
        <h3>
          <NavLink to={link}>{p.name}</NavLink>
        </h3>
        <p className="product_price">
          {formatPrice(p.new_price)}
          {hasDiscount && (
            <span className="old_price">{formatPrice(p.old_price)}</span>
          )}
        </p>
      </div>
    </article>
  );
};

export default Item;
