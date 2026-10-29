
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext.jsx";
import { PAYMENT_METHODS } from "../../page/paymentConfig.js";
import { createOrder } from "../../lib/orderApi.js";
import { normalizePhone, isEthiopianPhone } from "../../page/orderapi.js";
import "./CheckOut.css";

const ORDER_ID_PATTERN = /^[1-9]\d{0,14}$/;

const isValidOrderId = (value) =>
  (typeof value === "string" || typeof value === "number") &&
  ORDER_ID_PATTERN.test(String(value)) &&
  Number.isSafeInteger(Number(value));

const formatPrice = (value) => {
  const amount = Number(value);

  return `ETB ${(Number.isFinite(amount) && amount >= 0
    ? amount
    : 0
  ).toLocaleString("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Supports common response shapes:
 * { id, payment }
 * { order: { id }, payment }
 * { data: { order: { id }, payment } }
 * { data: { id, payment } }
 *
 * Adjust this helper if your API uses a different contract.
 */
const normalizeCreateOrderResponse = (response) => {
  const candidates = [
    response?.order,
    response?.data?.order,
    response?.data,
    response,
  ];

  const order = candidates.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      isValidOrderId(
        candidate.id ??
          candidate.order_id ??
          candidate.orderId,
      ),
  );

  const id =
    order?.id ??
    order?.order_id ??
    order?.orderId ??
    response?.orderId ??
    response?.order_id;

  const payment =
    response?.payment ??
    response?.data?.payment ??
    order?.payment ??
    response?.data?.data?.payment ??
    null;

  const checkoutUrl =
    payment?.checkout_url ??
    payment?.checkoutUrl ??
    payment?.data?.checkout_url ??
    null;

  if (!isValidOrderId(id)) {
    throw new Error(
      "The server created a response without a valid numeric order ID. Check the createOrder API response.",
    );
  }

  return {
    id: String(id),
    payment,
    checkoutUrl,
  };
};

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

  const method = PAYMENT_METHODS.find((item) => item.id === methodId);
  const zoneLabel = zones.find(
    (zone) => String(zone.id) === String(zoneId),
  )?.label;

  const setField = (key) => (event) => {
    const value = event.target.value;

    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setErrors((current) => {
      if (!current[key]) return current;

      return {
        ...current,
        [key]: "",
      };
    });
  };

  const validate = () => {
    const nextErrors = {};

    if (form.name.trim().length < 3) {
      nextErrors.name = "Please enter your full name.";
    }

    if (!isEthiopianPhone(form.phone)) {
      nextErrors.phone =
        "Enter a valid mobile number, for example 0911 23 45 67.";
    }

    if (form.address.trim().length < 6) {
      nextErrors.address =
        "Please enter your delivery address (area, street, landmark).";
    }

    if (zoneId == null || zoneId === "") {
      nextErrors.zoneId = "Please select a delivery area.";
    }

    if (!method) {
      nextErrors.payment = "Please select a valid payment method.";
    }

    return nextErrors;
  };

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setSubmitError("");

    if (!lines.length) {
      setSubmitError("Your cart is empty. Add products before checking out.");
      return;
    }

    if (stockProblem) {
      setSubmitError(
        "Some items in your cart are no longer available in that quantity. Please go back to the cart and fix them.",
      );
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => {
        document
          .querySelector('[aria-invalid="true"]')
          ?.focus();
      });
      return;
    }

    setSubmitting(true);

    try {
      // The backend should calculate prices, stock, delivery fees,
      // and the final total independently of frontend values.
      const response = await createOrder({
        customer: {
          name: form.name.trim(),
          phone: normalizePhone(form.phone),
          address: form.address.trim(),
          note: form.note.trim(),
        },
        zoneId,
        zoneLabel,
        paymentMethod: method.id,
      });

      const {
        id: orderId,
        checkoutUrl,
      } = normalizeCreateOrderResponse(response);

      if (method.online) {
        if (
          typeof checkoutUrl !== "string" ||
          checkoutUrl.trim() === ""
        ) {
          throw new Error(
            "The order was created, but the server did not return a Chapa checkout URL. Check the pending order before retrying to avoid creating a duplicate.",
          );
        }

        let parsedUrl;

        try {
          parsedUrl = new URL(checkoutUrl);
        } catch {
          throw new Error("The server returned an invalid checkout URL.");
        }

        if (parsedUrl.protocol !== "https:") {
          throw new Error("The payment checkout URL must use HTTPS.");
        }

        // The backend must only return a trusted, verified Chapa checkout URL.
        // Preserve the cart until the payment flow is completed.
        window.location.assign(parsedUrl.href);
        return;
      }

      // Cash on delivery: navigate only after the API returns a valid ID.
      navigate(`/order-success/${encodeURIComponent(orderId)}`, {
        replace: true,
      });

      clear();
    } catch (error) {
      console.error("Checkout error:", error);

      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not process your order. Please try again.",
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
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          aria-invalid={Boolean(error)}
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
          aria-invalid={Boolean(error)}
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

  return (
    <main className="co_page">
      <h1>Checkout</h1>

      <form className="co_layout" onSubmit={submit} noValidate>
        <div className="co_main">
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

            <div className={`co_field ${errors.zoneId ? "has_error" : ""}`}>
              <label htmlFor="co_zone">Deliver to</label>

              <select
                id="co_zone"
                value={zoneId ?? ""}
                onChange={(event) => {
                  setZoneId(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    zoneId: "",
                  }));
                }}
                aria-invalid={Boolean(errors.zoneId)}
                aria-describedby={
                  errors.zoneId ? "co_zone_err" : undefined
                }
              >
                <option value="" disabled>
                  Select delivery area
                </option>

                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label} ({formatPrice(zone.fee)})
                  </option>
                ))}
              </select>

              {errors.zoneId && (
                <p className="co_error" id="co_zone_err" role="alert">
                  {errors.zoneId}
                </p>
              )}
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

          <section className="co_card">
            <h2>2. Payment method</h2>

            <fieldset className="co_methods">
              <legend className="co_sr">Choose a payment method</legend>

              {PAYMENT_METHODS.map((item) => (
                <label
                  key={item.id}
                  className={`co_method ${
                    methodId === item.id ? "active" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={item.id}
                    checked={methodId === item.id}
                    onChange={() => setMethodId(item.id)}
                  />

                  <span className="co_method_text">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            {method?.online ? (
              <div className="co_pay">
                <p>
                  After you press the button, you will be redirected to
                  Chapa's checkout page. Your order is not considered paid
                  until your backend verifies the transaction.
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
              <dt>Delivery ({zoneLabel || "Selected area"})</dt>
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

          <button
            type="submit"
            className="co_btn"
            disabled={submitting || !method}
          >
            {submitting
              ? method?.online
                ? "Opening Chapa..."
                : "Placing order..."
              : method?.online
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
