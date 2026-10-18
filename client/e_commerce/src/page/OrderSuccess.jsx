import React from "react";
import { NavLink, useParams } from "react-router-dom";
import { SHOP } from "./paymentConfig";
import { getOrder, buildOrderMessage } from "./Orderapi.js";
import "../component/checkOut/CheckOut.css";

const formatPrice = (p) => `ETB ${(p || 0).toLocaleString()}`;

const OrderSuccess = () => {
  const { orderId } = useParams();
  const order = getOrder(orderId);

  if (!order) {
    return (
      <main className="co_page co_empty">
        <h1>Order not found</h1>
        <p>We could not find this order on this device.</p>
        <NavLink to="/" className="co_btn co_btn_link">
          Back to home
        </NavLink>
      </main>
    );
  }

  const isCod = order.paymentMethod === "cod";
  const waReady = /^\d{11,15}$/.test(SHOP.whatsapp);
  const waLink = `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(
    buildOrderMessage(order),
  )}`;

  return (
    <main className="co_page co_done">
      <div className="co_done_head">
        <span className="co_tick" aria-hidden="true">
          &#10003;
        </span>
        <h1>Thank you, {order.customer.name.split(" ")[0]}!</h1>
        <p>
          Your order <strong>{order.id}</strong> has been received.
        </p>
      </div>

      <section className="co_card">
        <h2>What happens next</h2>
        {isCod ? (
          <p>
            We will call <strong>{order.customer.phone}</strong> to confirm your
            order. Please have <strong>{formatPrice(order.total)}</strong> in
            cash ready when it arrives.
          </p>
        ) : (
          <p>
            We will verify your {order.paymentLabel} payment (reference{" "}
            <strong>{order.paymentRef}</strong>) and then call{" "}
            <strong>{order.customer.phone}</strong> to confirm delivery.
          </p>
        )}
        {waReady && (
          <a
            className="co_btn co_btn_link"
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Send this order to us on WhatsApp
          </a>
        )}
      </section>

      <section className="co_card">
        <h2>Order details</h2>
        <ul className="co_items co_items_plain">
          {order.items.map((i, idx) => (
            <li key={`${i.id}-${i.size}-${idx}`}>
              <span className="co_item_name">
                {i.qty} x {i.name}
                {i.size && <small>Size {i.size}</small>}
              </span>
              <span>{formatPrice(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="co_totals">
          <div>
            <dt>Items</dt>
            <dd>{formatPrice(order.subtotal)}</dd>
          </div>
          <div>
            <dt>Delivery ({order.zoneLabel})</dt>
            <dd>
              {order.deliveryFee ? formatPrice(order.deliveryFee) : "Free"}
            </dd>
          </div>
          <div className="co_grand">
            <dt>Total</dt>
            <dd>{formatPrice(order.total)}</dd>
          </div>
        </dl>
        <p className="co_meta">
          <strong>Payment:</strong> {order.paymentLabel}
          <br />
          <strong>Deliver to:</strong> {order.customer.address}
        </p>
      </section>

      <NavLink to="/" className="co_back">
        Continue shopping
      </NavLink>
    </main>
  );
};

export default OrderSuccess;
