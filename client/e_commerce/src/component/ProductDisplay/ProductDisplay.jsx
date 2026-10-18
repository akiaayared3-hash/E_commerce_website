import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { FaRegHeart, FaHeart } from "react-icons/fa";
import { useWishList } from "../../page/WishList";
import { useCart } from "../../page/CartContext";
import { getStock } from "../Assets/stock.js";
import ProductGallery from "../ProductGallery/ProductGallery";
import "./ProductDisplay.css";

const formatPrice = (p) => (p ? `ETB ${p.toLocaleString()}` : "ETB --");

// edit these to the sizes you really sell
const SIZES = {
  clothes: ["S", "M", "L", "XL", "XXL", "XXXL"],
  t_shirt: ["S", "M", "L", "XL", "XXL", "XXXL"],
  shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
};

const ProductDisplay = ({ product }) => {
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(null); // text of the "added" message
  const { has, toggle } = useWishList();
  const { addItem, lines, MAX_QTY } = useCart();

  // how many of this product can still be added (stock and cap, minus what is in the cart)
  const stock = product ? getStock(product.id) : 0;
  const inCart = product
    ? lines.filter((l) => l.id === product.id).reduce((n, l) => n + l.qty, 0)
    : 0;
  const available = Math.max(0, Math.min(MAX_QTY, stock) - inCart);

  // start fresh when the user opens a different product
  useEffect(() => {
    setSize("");
    setQty(1);
    setError("");
    setAdded(null);
  }, [product?.id]);

  // keep the chosen quantity inside what is available
  useEffect(() => {
    setQty((q) => Math.min(q, Math.max(1, available)));
  }, [available]);

  if (!product) return null;

  const liked = has(product.id);
  const sizes = SIZES[product.category] || [];
  const hasPrice = Boolean(product.new_price); // "coming soon" items have no price
  const soldOut = hasPrice && stock <= 0;
  const maxedInCart = hasPrice && stock > 0 && available <= 0;
  const canBuy = hasPrice && !soldOut;
  const hasDiscount = product.old_price > product.new_price;
  const off = hasDiscount
    ? Math.round((1 - product.new_price / product.old_price) * 100)
    : 0;

  const pickSize = (s) => {
    setSize(s);
    setError("");
    setAdded(null);
  };

  const changeQty = (n) =>
    setQty(Math.min(Math.max(1, available), Math.max(1, qty + n)));

  const addToCart = () => {
    if (!canBuy || maxedInCart) return;
    if (sizes.length && !size) {
      setError("Please choose a size.");
      setAdded(null);
      return;
    }
    const res = addItem({ id: product.id, size, qty });
    if (!res.ok) {
      setAdded(null);
      setError(
        res.reason === "soldout"
          ? "Sorry, this item is sold out."
          : `You already have the most we can offer (${res.max}) in your cart.`,
      );
      return;
    }
    setError("");
    setQty(1);
    setAdded(
      res.capped
        ? `Added ${res.added} x ${product.name}. That is the most we can offer (${res.max}).`
        : `Added ${res.added} x ${product.name}${size ? ` (size ${size})` : ""} to your cart.`,
    );
    // want to jump straight to the cart instead? use:
    //   const navigate = useNavigate();  ...  navigate("/cart");
  };

  return (
    <section className="pdisp">
      {/* PHOTOS */}
      <div className="pdisp_gallery">
        <ProductGallery product={product} />
        {hasDiscount && <span className="pdisp_badge">-{off}%</span>}
      </div>

      {/* INFO */}
      <div className="pdisp_info">
        <span className="pdisp_cat">{product.category.replace("_", "-")}</span>
        <h1>{product.name}</h1>

        <p className="pdisp_price">
          {formatPrice(product.new_price)}
          {hasDiscount && (
            <span className="pdisp_old">{formatPrice(product.old_price)}</span>
          )}
        </p>

        {hasPrice && (
          <p
            className={
              soldOut
                ? "pdisp_stock out"
                : stock <= 5
                  ? "pdisp_stock low"
                  : "pdisp_stock"
            }
          >
            {soldOut
              ? "Sold out"
              : stock <= 5
                ? `Only ${stock} left in stock`
                : "In stock"}
          </p>
        )}

        <p className="pdisp_desc">{product.description}</p>

        {canBuy && sizes.length > 0 && (
          <div className="pdisp_block">
            <div className="pdisp_label">
              Select size {size && <strong>: {size}</strong>}
            </div>
            <div className="pdisp_sizes" role="group" aria-label="Select size">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={size === s ? "pdisp_size active" : "pdisp_size"}
                  aria-pressed={size === s}
                  onClick={() => pickSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {canBuy && (
          <div className="pdisp_block">
            <div className="pdisp_label">Quantity</div>
            <div className="pdisp_qty">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => changeQty(-1)}
                disabled={qty <= 1}
              >
                -
              </button>
              <span aria-live="polite">{maxedInCart ? 0 : qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => changeQty(1)}
                disabled={qty >= available}
              >
                +
              </button>
            </div>
            {inCart > 0 && (
              <p className="pdisp_incart">{inCart} already in your cart</p>
            )}
            {!maxedInCart && qty >= available && available > 0 && (
              <p className="pdisp_incart" role="status">
                {available === stock - inCart && stock <= MAX_QTY
                  ? `That's all we have (${stock} in stock).`
                  : `Maximum ${MAX_QTY} per order. For bigger orders, please contact us.`}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="pdisp_error" role="alert">
            {error}
          </p>
        )}

        <div className="pdisp_actions">
          <button
            type="button"
            className="pdisp_btn"
            onClick={addToCart}
            disabled={!canBuy || maxedInCart}
          >
            {!hasPrice
              ? "Coming soon"
              : soldOut
                ? "Sold out"
                : maxedInCart
                  ? "Maximum in cart"
                  : "Add to cart"}
          </button>
          <button
            type="button"
            className={liked ? "pdisp_heart liked" : "pdisp_heart"}
            aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={liked}
            onClick={() => toggle(product.id)}
          >
            {liked ? <FaHeart /> : <FaRegHeart />}
          </button>
        </div>

        {added && (
          <p className="pdisp_notice" role="status">
            {added}{" "}
            <NavLink to="/cart" className="pdisp_notice_link">
              View cart
            </NavLink>
          </p>
        )}

        <NavLink to="/contacts" className="pdisp_ask">
          Ask about this item
        </NavLink>

        <ul className="pdisp_notes">
          <li>Pay with Chapa or Cash on Delivery</li>
          <li>Delivery in Ethiopia</li>
        </ul>
      </div>
    </section>
  );
};

export default ProductDisplay;
