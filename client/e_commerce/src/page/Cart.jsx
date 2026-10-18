import React from "react";
import { NavLink } from "react-router-dom";
import { useCart } from "../page/CartContext";
import "./css/Cart.css";

const formatPrice = (p) => `ETB ${(p || 0).toLocaleString()}`;

const Cart = () => {
  const {
    lines,
    count,
    subtotal,
    deliveryFee,
    freeDelivery,
    amountToFree,
    total,
    zones,
    zoneId,
    setZoneId,
    setQty,
    removeItem,
    clear,
    MAX_QTY,
    stockProblem,
  } = useCart();

  if (lines.length === 0) {
    return (
      <main className="cart_page cart_empty">
        <h1>Your cart is empty</h1>
        <p>Looks like you haven't added anything yet.</p>
        <NavLink to="/" className="cart_btn">
          Continue shopping
        </NavLink>
      </main>
    );
  }

  return (
    <main className="cart_page">
      <h1>
        Shopping cart <span className="cart_count">({count})</span>
      </h1>

      <div className="cart_layout">
        {/* ITEMS */}
        <section className="cart_items" aria-label="Cart items">
          {lines.map(({ key, product, size, qty, lineTotal, max }) => {
            // "max" is the most this line may hold (stock and cap, minus other sizes)
            const hasStock = typeof product.stock === "number";
            const atLimit = qty >= max;
            const soldOut = hasStock && product.stock <= 0;
            const overStock = !soldOut && qty > max;
            const lowStock =
              hasStock && product.stock > 0 && product.stock <= 5;

            return (
              <article className="cart_row" key={key}>
                <NavLink to={`/product/${product.id}`} className="cart_photo">
                  {product.image ? (
                    <img src={product.image} alt={product.name} />
                  ) : (
                    <span>No photo</span>
                  )}
                </NavLink>

                <div className="cart_info">
                  <span className="cart_cat">
                    {product.category.replace("_", "-")}
                  </span>
                  <h3>
                    <NavLink to={`/product/${product.id}`}>
                      {product.name}
                    </NavLink>
                  </h3>
                  {size && <p className="cart_size">Size: {size}</p>}
                  <p className="cart_unit">{formatPrice(product.new_price)}</p>

                  {soldOut && (
                    <p className="cart_stock cart_stock_out" role="alert">
                      Sold out. Please remove this item.
                    </p>
                  )}
                  {!soldOut && overStock && (
                    <p className="cart_stock cart_stock_out" role="alert">
                      Only {product.stock} in stock. Please reduce the quantity.
                    </p>
                  )}
                  {!soldOut && !overStock && lowStock && (
                    <p className="cart_stock cart_stock_low">
                      Only {product.stock} left in stock.
                    </p>
                  )}

                  <div className="cart_controls">
                    <div className="cart_qty">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${product.name}`}
                        onClick={() => setQty(key, qty - 1)}
                        disabled={qty <= 1}
                      >
                        -
                      </button>
                      <span aria-live="polite">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${product.name}`}
                        onClick={() => setQty(key, qty + 1)}
                        disabled={atLimit || soldOut}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="cart_remove"
                      onClick={() => removeItem(key)}
                    >
                      Remove
                    </button>
                  </div>

                  {atLimit && !soldOut && !overStock && (
                    <p className="cart_limit" role="status">
                      {hasStock && product.stock <= MAX_QTY
                        ? `That's all we have: ${product.stock} in stock.`
                        : `Maximum ${MAX_QTY} per order. For bigger orders, please contact us.`}
                    </p>
                  )}
                </div>

                <p className="cart_line_total">{formatPrice(lineTotal)}</p>
              </article>
            );
          })}

          <button type="button" className="cart_clear" onClick={clear}>
            Clear cart
          </button>
        </section>

        {/* SUMMARY */}
        <aside className="cart_summary" aria-label="Order summary">
          <h2>Order summary</h2>

          <label className="cart_zone">
            <span>Deliver to</span>
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label} ({formatPrice(z.fee)})
                </option>
              ))}
            </select>
          </label>

          <dl>
            <div>
              <dt>Items ({count})</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd className={freeDelivery ? "cart_free" : ""}>
                {freeDelivery ? "Free" : formatPrice(deliveryFee)}
              </dd>
            </div>
            <div className="cart_total">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          {amountToFree > 0 && (
            <p className="cart_hint">
              Add {formatPrice(amountToFree)} more to get free delivery.
            </p>
          )}

          {stockProblem ? (
            <>
              <button type="button" className="cart_btn" disabled>
                Checkout
              </button>
              <p className="cart_stock cart_stock_out" role="alert">
                Some items are sold out or above the available stock. Please fix
                them to continue.
              </p>
            </>
          ) : (
            <NavLink to="/checkout" className="cart_btn">
              Checkout
            </NavLink>
          )}
          <NavLink to="/" className="cart_continue">
            Continue shopping
          </NavLink>

          <ul className="cart_notes">
            <li>Pay with Chapa or Cash on Delivery</li>
            <li>Delivery in Ethiopia</li>
          </ul>
        </aside>
      </div>
    </main>
  );
};

export default Cart;
