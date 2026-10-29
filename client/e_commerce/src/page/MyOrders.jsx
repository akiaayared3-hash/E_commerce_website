import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api.js";
import "./css/MyOrders.css";

const PAGE_SIZE = 10;
const MAX_PAGE = 100_000;
const ORDER_ID_PATTERN = /^[1-9]\d{0,14}$/;

const STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function normalizeOrderId(value) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "number" &&
      (!Number.isSafeInteger(value) || value <= 0)) ||
    !ORDER_ID_PATTERN.test(String(value))
  ) {
    return null;
  }

  return String(value);
}

function getResponseData(response) {
  let current = response;

  for (let i = 0; i < 4; i += 1) {
    if (!isRecord(current)) break;

    if (current.status === "error") {
      throw new Error(
        typeof current.message === "string"
          ? current.message
          : "Unable to load your orders.",
      );
    }

    if (isRecord(current.data)) {
      current = current.data;
      continue;
    }

    break;
  }

  return current;
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "—";
  }

  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getStatus(order) {
  const raw = String(order.order_status ?? order.status ?? "pending")
    .trim()
    .toLowerCase();

  return {
    value: raw,
    label:
      STATUS_LABELS[raw] ??
      (raw
        ? raw
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
        : "Pending"),
  };
}

function getOrderTotal(order) {
  return order.total_amount ?? order.total ?? order.grand_total;
}

function getOrderDate(order) {
  return (
    order.created_at ??
    order.order_date ??
    order.placed_at ??
    order.createdAt ??
    null
  );
}

function extractOrders(response) {
  const data = getResponseData(response);

  if (Array.isArray(data)) {
    return {
      orders: data,
      pagination: null,
    };
  }

  if (!isRecord(data)) {
    throw new Error("The server returned an invalid orders response.");
  }

  const orders = data.orders ?? data.results;

  if (!Array.isArray(orders)) {
    throw new Error("The server response does not contain an orders list.");
  }

  return {
    orders,
    pagination: isRecord(data.pagination) ? data.pagination : null,
  };
}

function getPageCount(pagination) {
  if (!pagination) return null;

  const totalPages = Number(pagination.totalPages ?? pagination.total_pages);

  if (
    Number.isSafeInteger(totalPages) &&
    totalPages >= 1 &&
    totalPages <= MAX_PAGE
  ) {
    return totalPages;
  }

  const total = Number(pagination.total);
  const limit = Number(pagination.limit ?? PAGE_SIZE);

  if (
    Number.isSafeInteger(total) &&
    total >= 0 &&
    Number.isSafeInteger(limit) &&
    limit > 0
  ) {
    return Math.max(1, Math.ceil(total / limit));
  }

  return null;
}

function getErrorMessage(error) {
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }

  return "We couldn't load your orders. Please try again.";
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const loadOrders = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest(
          `/api/orders?page=${page}&limit=${PAGE_SIZE}`,
          { signal },
        );

        if (signal.aborted) return;

        const result = extractOrders(response);

        const validOrders = result.orders.map((order) => {
          if (!isRecord(order)) {
            throw new Error("The server returned an invalid order.");
          }

          const id = normalizeOrderId(order.id ?? order.order_id);

          if (!id) {
            throw new Error(
              "An order is missing a valid ID. Please check the orders API response.",
            );
          }

          return { ...order, id };
        });

        setOrders(validOrders);
        setTotalPages(getPageCount(result.pagination));
      } catch (err) {
        if (signal.aborted) return;

        setOrders([]);
        setTotalPages(null);
        setError(getErrorMessage(err));
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [page, retryKey],
  );

  useEffect(() => {
    const controller = new AbortController();

    loadOrders(controller.signal);

    return () => controller.abort();
  }, [loadOrders]);

  const retry = () => setRetryKey((value) => value + 1);

  const previousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const nextPage = () => {
    setPage((current) =>
      totalPages == null ? current + 1 : Math.min(totalPages, current + 1),
    );
  };

  return (
    <section className="my-orders" aria-label="My orders">
      {loading && (
        <div className="my-orders__state" role="status" aria-live="polite">
          <span className="my-orders__spinner" aria-hidden="true" />
          <p>Loading your orders...</p>
        </div>
      )}

      {!loading && error && (
        <div className="my-orders__state my-orders__state--error">
          <h2>Unable to load orders</h2>
          <p role="alert">{error}</p>
          <button type="button" className="my-orders__button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="my-orders__state">
          <h2>No orders yet</h2>
          <p>Your purchases will appear here when you place an order.</p>
          <Link to="/" className="my-orders__button">
            Browse products
          </Link>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <div className="my-orders__list">
            {orders.map((order) => {
              const status = getStatus(order);
              const total = getOrderTotal(order);
              const date = getOrderDate(order);
              const itemCount = Array.isArray(order.items)
                ? order.items.length
                : Array.isArray(order.order_items)
                  ? order.order_items.length
                  : null;

              return (
                <article className="my-orders__card" key={order.id}>
                  <div className="my-orders__card-top">
                    <div>
                      <p className="my-orders__eyebrow">Order number</p>
                      <h2>#{order.id}</h2>
                    </div>

                    <span
                      className={`my-orders__status my-orders__status--${status.value.replace(
                        /[^a-z0-9_-]/g,
                        "",
                      )}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="my-orders__details">
                    <div>
                      <span>Placed on</span>
                      <strong>{formatDate(date)}</strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong>{formatMoney(total)}</strong>
                    </div>

                    {itemCount !== null && (
                      <div>
                        <span>Product lines</span>
                        <strong>{itemCount}</strong>
                      </div>
                    )}
                  </div>

                  <div className="my-orders__card-bottom">
                    <span className="my-orders__payment">
                      {String(order.payment_method ?? "cod").toLowerCase() ===
                      "chapa"
                        ? "Chapa"
                        : "Cash on Delivery"}
                    </span>

                    <Link
                      className="my-orders__link"
                      to={`/order-success/${encodeURIComponent(order.id)}`}
                    >
                      View order
                      <span aria-hidden="true"> →</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <nav className="my-orders__pagination" aria-label="Order pages">
            <button
              type="button"
              onClick={previousPage}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>

            <span>
              Page {page}
              {totalPages !== null ? ` of ${totalPages}` : ""}
            </span>

            <button
              type="button"
              onClick={nextPage}
              disabled={
                loading ||
                (totalPages !== null && page >= totalPages) ||
                (totalPages === null && orders.length < PAGE_SIZE)
              }
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
