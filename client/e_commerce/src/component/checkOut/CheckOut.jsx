import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../../page/CartContext";
import { PAYMENT_METHODS, API_BASE } from "../../page/paymentConfig.js";
import {
  createOrder,
  normalizePhone,
  isEthiopianPhone,
} from "../../page/Orderapi.js";
import "./CheckOut.css";

const formatPrice = (p) => `ETB ${(p || 0).toLocaleString()}`;

const Checkout = () => {
  const navigate = useNavigate();
  const {
    lines,
    subtotal,
    deliveryFee,
    freeDelivery,
    total,
    zones,
    zoneId,
    setZoneId,
    clear,
    stockProblem,
  } = useCart();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });
  const [methodId, setMethodId] = useState("chapa");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  if (lines.length === 0 && !submitting) {
    return (
      <main className="co_page co_empty">
        <h1>Nothing to check out</h1>
        <p>Your cart is empty.</p>
        <NavLink to="/" className="co_btn co_btn_link">
          Continue shopping
        </NavLink>
      </main>
    );
  }

  const method = PAYMENT_METHODS.find((m) => m.id === methodId);
  const zoneLabel = zones.find((z) => z.id === zoneId)?.label;

  const setField = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: "" });
  };

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 3) e.name = "Please enter your full name.";
    if (!isEthiopianPhone(form.phone))
      e.phone = "Enter a valid mobile number, for example 0911 23 45 67.";
    if (form.address.trim().length < 6)
      e.address =
        "Please enter your delivery address (area, street, landmark).";
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setSubmitError("");
    if (stockProblem) {
      setSubmitError(
        "Some items in your cart are no longer available in that quantity. Please go back to the cart and fix them.",
      );
      return;
    }
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setTimeout(
        () => document.querySelector('[aria-invalid="true"]')?.focus(),
        0,
      );
      return;
    }

    setSubmitting(true);
    const customer = {
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      address: form.address.trim(),
      note: form.note.trim(),
    };
    const order = {
      customer,
      zoneId,
      zoneLabel,
      items: lines.map((l) => ({
        id: l.product.id,
        name: l.product.name,
        size: l.size,
        qty: l.qty,
        unitPrice: l.product.new_price,
        lineTotal: l.lineTotal,
      })),
      subtotal,
      deliveryFee,
      total,
      paymentMethod: method.id,
      paymentLabel: method.label,
      paymentRef: "",
      // Chapa orders wait until the server verifies the payment
      status: method.online ? "awaiting_payment" : "pending",
    };

    try {
      const saved = await createOrder(order);

      if (method.online) {
        // Ask OUR server to start the Chapa payment (secret key stays there)
        const res = await fetch(`${API_BASE}/api/chapa/initialize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: saved.id,
            amount: total,
            name: customer.name,
            phone: customer.phone,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.checkout_url)
          throw new Error(
            data.message
              ? JSON.stringify(data.message)
              : `server ${res.status}`,
          );
        // Keep the cart until payment is confirmed (clear it on the success page)
        window.location.href = data.checkout_url;
        return;
      }

      // Cash on delivery: order is final now
      navigate(`/order-success/${saved.id}`, { replace: true });
      clear();
    } catch (err) {
      console.error("Checkout error:", err);
      setSubmitError(
        method.online
          ? `We could not start the Chapa payment (${err.message}). Please try again or choose Cash on Delivery.`
          : "We could not send your order. Please check your connection and try again.",
      );
      setSubmitting(false);
    }
  };

  const field = (id, label, props, error, hint) => (
    <div className={`co_field ${error ? "has_error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {props.as === "textarea" ? (
        <textarea
          id={id}
          rows={props.rows || 3}
          value={props.value}
          onChange={props.onChange}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}_err` : undefined}
        />
      ) : (
        <input
          id={id}
          type={props.type || "text"}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          placeholder={props.placeholder}
          value={props.value}
          onChange={props.onChange}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}_err` : undefined}
        />
      )}
      {hint && !error && <p className="co_hint">{hint}</p>}
      {error && (
        <p className="co_error" id={`${id}_err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <main className="co_page">
      <h1>Checkout</h1>

      <form className="co_layout" onSubmit={submit} noValidate>
        <div className="co_main">
          {/* 1. DELIVERY DETAILS */}
          <section className="co_card">
            <h2>1. Delivery details</h2>

            {field(
              "co_name",
              "Full name",
              {
                value: form.name,
                onChange: setField("name"),
                autoComplete: "name",
              },
              errors.name,
            )}
            {field(
              "co_phone",
              "Phone number",
              {
                type: "tel",
                inputMode: "tel",
                autoComplete: "tel",
                placeholder: "09 11 23 45 67",
                value: form.phone,
                onChange: setField("phone"),
              },
              errors.phone,
              "We call this number to confirm delivery.",
            )}

            <div className="co_field">
              <label htmlFor="co_zone">Deliver to</label>
              <select
                id="co_zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label} ({formatPrice(z.fee)})
                  </option>
                ))}
              </select>
            </div>

            {field(
              "co_address",
              "Address",
              {
                as: "textarea",
                value: form.address,
                onChange: setField("address"),
              },
              errors.address,
              "Sub-city / area, street, and a landmark that helps the driver.",
            )}
            {field("co_note", "Order note (optional)", {
              as: "textarea",
              rows: 2,
              value: form.note,
              onChange: setField("note"),
            })}
          </section>

          {/* 2. PAYMENT */}
          <section className="co_card">
            <h2>2. Payment method</h2>

            <fieldset className="co_methods">
              <legend className="co_sr">Choose a payment method</legend>
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`co_method ${methodId === m.id ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m.id}
                    checked={methodId === m.id}
                    onChange={() => setMethodId(m.id)}
                  />
                  <span className="co_method_text">
                    <strong>{m.label}</strong>
                    <small>{m.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            {method.online ? (
              <div className="co_pay">
                <p>
                  After you press the button, you will go to Chapa's secure page
                  to pay <strong>{formatPrice(total)}</strong> with Telebirr,
                  CBE Birr, a bank account or a card. Then you come back here
                  and your order is confirmed.
                </p>
              </div>
            ) : (
              <div className="co_pay co_pay_cod">
                <p>
                  Please have <strong>{formatPrice(total)}</strong> in cash
                  ready when the order arrives (items plus delivery).
                </p>
              </div>
            )}
          </section>
        </div>

        {/* SUMMARY */}
        <aside className="co_summary" aria-label="Order summary">
          <h2>Your order</h2>
          <ul className="co_items">
            {lines.map(({ key, product, size, qty, lineTotal }) => (
              <li key={key}>
                <span className="co_item_photo">
                  {product.image && <img src={product.image} alt="" />}
                  <em>{qty}</em>
                </span>
                <span className="co_item_name">
                  {product.name}
                  {size && <small>Size {size}</small>}
                </span>
                <span>{formatPrice(lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="co_totals">
            <div>
              <dt>Items</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery ({zoneLabel})</dt>
              <dd className={freeDelivery ? "co_free" : ""}>
                {freeDelivery ? "Free" : formatPrice(deliveryFee)}
              </dd>
            </div>
            <div className="co_grand">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          {submitError && (
            <p className="co_error co_submit_error" role="alert">
              {submitError}
            </p>
          )}

          <button type="submit" className="co_btn" disabled={submitting}>
            {submitting
              ? method.online
                ? "Opening Chapa..."
                : "Placing order..."
              : method.online
                ? "Pay with Chapa"
                : "Place order (pay on delivery)"}
          </button>
          <NavLink to="/cart" className="co_back">
            Back to cart
          </NavLink>
        </aside>
      </form>
    </main>
  );
};

export default Checkout;
