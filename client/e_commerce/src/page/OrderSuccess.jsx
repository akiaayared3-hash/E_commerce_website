
import { useCallback, useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { getOrder } from "../lib/orderApi.js";
import "../component/checkOut/CheckOut.css";

const ORDER_ID_PATTERN = /^[1-9]\d{0,15}$/;

const isValidOrderId = (value) =>
  typeof value === "string" &&
  ORDER_ID_PATTERN.test(value) &&
  Number.isSafeInteger(Number(value));

const formatPrice = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "ETB 0.00";
  }

  return `ETB ${amount.toLocaleString("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getErrorMessage = (error) => {
  const status = error?.status ?? error?.response?.status;

  if (status === 401) {
    return "Your session has expired. Please sign in to view your order.";
  }

  if (status === 403) {
    return "You do not have permission to view this order.";
  }

  if (status === 404) {
    return "This order could not be found on your account.";
  }

  if (error?.name === "TypeError") {
    return "Unable to connect to the server. Check your connection and try again.";
  }

  return error instanceof Error
    ? error.message
    : "We could not load your order. Please try again.";
};

const getPaymentLabel = (order) => {
  if (order?.paymentLabel) {
    return order.paymentLabel;
  }

  const method = String(order?.paymentMethod ?? "")
    .trim()
    .toLowerCase();

  if (["cod", "cash_on_delivery", "cash on delivery"].includes(method)) {
    return "Cash on delivery";
  }

  if (["chapa", "online", "online_payment"].includes(method)) {
    return "Online payment";
  }

  return method || "Not specified";
};

const getOrderStatus = (order) =>
  String(order?.status || "pending")
    .replaceAll("_", " ")
    .toUpperCase();

const OrderSuccess = () => {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const loadOrder = useCallback(
    async (signal) => {
      if (!isValidOrderId(orderId)) {
        setOrder(null);
        setErrorMessage(
          "The order ID in this URL is invalid. Please return to checkout and use the order ID returned by the server.",
        );
        setStatus("error");
        return;
      }

      setOrder(null);
      setErrorMessage("");
      setStatus("loading");

      try {
        // getOrder() already normalizes the response using toViewOrder().
        const result = await getOrder(orderId);

        if (signal.aborted) return;

        if (
          !result ||
          String(result.id) !== orderId ||
          !Array.isArray(result.items)
        ) {
          throw new Error(
            "The server did not return the expected order details.",
          );
        }

        setOrder(result);
        setStatus("ready");
      } catch (error) {
        if (signal.aborted) return;

        console.error("Order loading failed:", {
          orderId,
          error,
        });

        setErrorMessage(getErrorMessage(error));
        setStatus("error");
      }
    },
    [orderId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadOrder(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadOrder, retryCount]);

  if (status === "loading") {
    return (
      <main
        className="co_page co_empty"
        aria-live="polite"
        aria-busy="true"
      >
        <p>Loading your order...</p>
      </main>
    );
  }

  if (status === "error" || !order) {
    return (
      <main className="co_page co_empty">
        <h1>Unable to display your order</h1>

        <p role="alert">
          {errorMessage || "We could not load your order."}
        </p>

        <button
          type="button"
          className="co_btn"
          onClick={() => setRetryCount((count) => count + 1)}
          disabled={!isValidOrderId(orderId)}
        >
          Try again
        </button>

        <NavLink to="/" className="co_btn co_btn_link">
          Back to home
        </NavLink>
      </main>
    );
  }

  // These properties match the normalized object from toViewOrder().
  const customerName = order.customer?.name ?? "";
  const firstName = customerName.trim().split(/\s+/)[0] ?? "";
  const customerPhone = order.customer?.phone ?? "";
  const customerAddress = order.customer?.address ?? "";
  const paymentMethod = getPaymentLabel(order);
  const method = String(order.paymentMethod ?? "").toLowerCase();

  const isCod = [
    "cod",
    "cash_on_delivery",
    "cash on delivery",
  ].includes(method);

  const total = order.total;
  const items = order.items;
  const subtotal = order.subtotal;

  const deliveryFee = order.deliveryFee;
  const hasDeliveryFee =
    deliveryFee != null && Number.isFinite(Number(deliveryFee));

  return (
    <main className="co_page co_done">
      <header className="co_done_head">
        <span className="co_tick" aria-hidden="true">
          &#10003;
        </span>

        <h1>Thank you{firstName ? `, ${firstName}` : ""}!</h1>

        <p>
          Your order <strong>#{order.id}</strong> has been received.
        </p>

        <p>
          <strong>Order status:</strong> {getOrderStatus(order)}
        </p>
      </header>

      <section className="co_card" aria-labelledby="next-steps-heading">
        <h2 id="next-steps-heading">What happens next</h2>

        {isCod ? (
          <p>
            We will contact you
            {customerPhone ? (
              <>
                {" "}at <strong>{customerPhone}</strong>
              </>
            ) : null}{" "}
            to confirm delivery. Please prepare{" "}
            <strong>{formatPrice(total)}</strong> for payment on delivery.
          </p>
        ) : (
          <p>
            Your order uses {paymentMethod}. Your order being received does
            not mean your online payment has succeeded. Check the verified
            payment status before treating the order as paid.
          </p>
        )}
      </section>

      <section className="co_card" aria-labelledby="order-details-heading">
        <h2 id="order-details-heading">Order details</h2>

        {items.length === 0 ? (
          <p>No order items were returned by the server.</p>
        ) : (
          <ul className="co_items co_items_plain">
            {items.map((item, index) => (
              <li
                key={
                  item.id ??
                  `${item.productVariantId ?? "item"}-${index}`
                }
              >
                <span className="co_item_name">
                  {Number(item.qty)} × {item.name ?? "Product"}
                  {item.sku ? <small>SKU: {item.sku}</small> : null}
                </span>

                <span>{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
        )}

        <dl className="co_totals">
          <div>
            <dt>Items subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>

          {hasDeliveryFee ? (
            <div>
              <dt>Delivery</dt>
              <dd>{formatPrice(deliveryFee)}</dd>
            </div>
          ) : null}

          <div className="co_grand">
            <dt>Total payable</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>

        <p className="co_meta">
          <strong>Payment:</strong> {paymentMethod}
          <br />
          <strong>Deliver to:</strong>{" "}
          {customerAddress || "Address unavailable"}
        </p>
      </section>

      <NavLink to="/" className="co_back">
        Continue shopping
      </NavLink>
    </main>
  );
};

export default OrderSuccess;