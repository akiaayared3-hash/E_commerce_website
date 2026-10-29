import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Eye,
  Loader2,
  RefreshCw,
  Package,
  ShoppingBag,
  CircleDollarSign,
  Clock3,
  MapPin,
  CreditCard,
  AlertCircle,
  AlertTriangle,
  History,
  X,
} from "lucide-react";

import { apiRequest, withQuery } from "../../src/lib/api.js";
import Modal from "./Modal.jsx";
import "./css/AdminPages.css";

const ORDERS = "/api/orders";
const LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 400;
const MAX_SEARCH_LENGTH = 100;
const MAX_NOTE_LENGTH = 500;
const MAX_TRACKING_LENGTH = 100;

/*
 * Keep synchronized with the backend order-status enum.
 * Backend is the source of truth.
 */
const STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const FINAL_STATUSES = new Set(["delivered", "cancelled"]);

const TRANSITIONS = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const FLOW = ["pending", "paid", "processing", "shipped", "delivered"];
const NEEDS_INPUT = new Set(["shipped", "cancelled"]);

const STALE_HOURS = {
  pending: 24,
  paid: 24,
  processing: 72,
  shipped: 240,
};

/*
 * Match the backend transition rules. Pending COD orders can move directly
 * to processing; other pending orders must be marked paid first.
 * Accept either a normalized order object or a status string for safe reuse.
 */
const allowedNext = (orderOrStatus) => {
  const isOrder =
    orderOrStatus !== null &&
    typeof orderOrStatus === "object" &&
    !Array.isArray(orderOrStatus);

  const status = String(
    isOrder
      ? (orderOrStatus.status ?? orderOrStatus.order_status ?? "")
      : (orderOrStatus ?? ""),
  )
    .trim()
    .toLowerCase();

  if (status === "pending" && isOrder) {
    const paymentMethod = String(
      orderOrStatus.paymentMethod ??
        orderOrStatus.payment_method ??
        orderOrStatus.payment?.method ??
        "",
    )
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    const isCod = [
      "cod",
      "cash",
      "cash_on_delivery",
      "cashondelivery",
    ].includes(paymentMethod);

    return isCod ? ["processing", "cancelled"] : ["paid", "cancelled"];
  }

  return TRANSITIONS[status] ?? [];
};

/* ------------------------------------------------------------------
   API helpers
------------------------------------------------------------------ */

const unwrap = (response) => response?.data ?? response;

const toList = (response) => {
  const data = unwrap(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;

  throw new Error(
    "The server returned an unexpected orders response. Check the API response format.",
  );
};

const toPaging = (response) => {
  const data = unwrap(response);
  return (
    data?.pagination ??
    data?.meta ??
    data?.pageInfo ??
    data?.page_info ??
    data ??
    {}
  );
};

const validNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toStatusCounts = (response, paging) => {
  const data = unwrap(response);
  const raw =
    data?.statusCounts ??
    data?.status_counts ??
    data?.counts ??
    paging?.statusCounts ??
    paging?.status_counts ??
    null;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    const number = validNumber(value);
    if (number !== null && number >= 0) {
      result[String(key).toLowerCase()] = number;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
};

const getErrorMessage = (error, fallback) => {
  const message =
    typeof error?.message === "string" ? error.message.trim() : "";
  return message || fallback;
};

const isConflict = (error) =>
  error?.status === 409 ||
  error?.statusCode === 409 ||
  error?.response?.status === 409 ||
  /conflict/i.test(String(error?.message ?? ""));

const joinParts = (parts) =>
  parts
    .filter((part) => part != null && String(part).trim() !== "")
    .map(String)
    .join(", ");

const getShippingAddress = (order) => {
  const address =
    order.shipping_address ?? order.shippingAddress ?? order.address ?? null;

  if (typeof address === "string") return address.trim();

  if (address && typeof address === "object") {
    return joinParts([
      address.address_line1 ?? address.addressLine1 ?? address.street,
      address.address_line2 ?? address.addressLine2,
      address.city,
      address.state ?? address.region,
      address.postal_code ?? address.postalCode,
      address.country,
    ]);
  }

  return joinParts([
    order.shipping_address_line1,
    order.shipping_address_line2,
    order.shipping_city,
    order.shipping_region,
    order.shipping_postal_code,
    order.shipping_country,
  ]);
};

const normalizeHistory = (order, id) => {
  const raw =
    order.status_history ?? order.statusHistory ?? order.history ?? [];

  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      key: entry.id ?? `${id}-history-${index}`,
      from: String(entry.from_status ?? entry.from ?? "")
        .trim()
        .toLowerCase(),
      to: String(entry.to_status ?? entry.to ?? entry.status ?? "")
        .trim()
        .toLowerCase(),
      at: entry.created_at ?? entry.createdAt ?? entry.at ?? null,
      by:
        entry.changed_by_name ??
        entry.changedBy ??
        entry.admin_name ??
        entry.by ??
        "",
      note: entry.note ?? entry.reason ?? "",
    }))
    .sort((a, b) => {
      const first = new Date(a.at).getTime();
      const second = new Date(b.at).getTime();
      if (!Number.isFinite(first) || !Number.isFinite(second)) return 0;
      return second - first;
    });
};

const normalize = (order) => {
  if (!order || typeof order !== "object" || Array.isArray(order)) {
    throw new Error("The server returned an invalid order.");
  }

  const id = order.id ?? order.order_id;
  if (id == null || String(id).trim() === "") {
    throw new Error("An order is missing its ID.");
  }

  const customer =
    order.customer_name ??
    order.shipping_full_name ??
    order.customer?.name ??
    (typeof order.customer === "string" ? order.customer : null) ??
    order.user?.name ??
    "Customer name unavailable";

  const rawItems = order.items ?? order.order_items ?? [];
  if (!Array.isArray(rawItems)) {
    throw new Error(`Order ${id} has an invalid items list.`);
  }

  const items = rawItems.map((item, index) => {
    const price = validNumber(
      item.unit_price ?? item.price ?? item.product_price,
    );
    const quantity = validNumber(item.quantity ?? item.qty);

    return {
      key:
        item.id ??
        item.order_item_id ??
        `${id}-${item.product_variant_id ?? "item"}-${index}`,
      name:
        item.product_name ??
        item.name ??
        item.variant_name ??
        item.sku ??
        "Product",
      sku: item.sku ?? "",
      size: item.size ?? "",
      color: item.color ?? "",
      quantity: quantity !== null && quantity >= 0 ? quantity : null,
      price: price !== null && price >= 0 ? price : null,
    };
  });

  const total = validNumber(
    order.total_amount ?? order.grand_total ?? order.total,
  );

  const rawStatus = String(order.status ?? order.order_status ?? "")
    .trim()
    .toLowerCase();

  const payment =
    order.payment && typeof order.payment === "object" ? order.payment : {};

  return {
    id: String(id),
    customer,
    email: order.customer_email ?? order.email ?? order.user?.email ?? "",
    phone: order.shipping_phone ?? order.phone ?? order.customer_phone ?? "",
    date: order.created_at ?? order.createdAt ?? order.date ?? null,
    updatedAt: order.updated_at ?? order.updatedAt ?? null,
    statusChangedAt:
      order.status_changed_at ??
      order.statusChangedAt ??
      order.updated_at ??
      order.updatedAt ??
      order.created_at ??
      order.createdAt ??
      null,
    total: total !== null && total >= 0 ? total : null,
    currency: order.currency ?? "USD",
    status: rawStatus || "unknown",
    paymentStatus: String(order.payment_status ?? payment.status ?? "")
      .trim()
      .toLowerCase(),
    paymentMethod: String(
      order.payment_method ?? payment.method ?? payment.provider ?? "",
    )
      .trim()
      .toLowerCase(),
    shippingAddress: getShippingAddress(order),
    shippingMethod: order.shipping_method ?? order.delivery_method ?? "",
    trackingNumber: order.tracking_number ?? order.trackingNumber ?? "",
    cancelReason:
      order.cancel_reason ??
      order.cancellation_reason ??
      order.cancelReason ??
      "",
    notes: order.customer_note ?? order.notes ?? "",
    history: normalizeHistory(order, id),
    items,
  };
};

const getOrder = (response) => {
  const data = unwrap(response);
  const order =
    data?.order ?? data?.item ?? data?.data?.order ?? data?.data?.item ?? data;
  return normalize(order);
};

/* ------------------------------------------------------------------
   Display helpers
------------------------------------------------------------------ */

const label = (value) => {
  if (!value) return "Unknown";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const money = (value, currency = "USD") => {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
};

const showDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDelayHours = (order) => {
  const limit = STALE_HOURS[order.status];
  if (!limit || !order.statusChangedAt) return null;
  const since = new Date(order.statusChangedAt).getTime();
  if (!Number.isFinite(since)) return null;
  const hours = (Date.now() - since) / 36e5;
  return hours > limit ? Math.floor(hours) : null;
};

const formatDelay = (hours) =>
  hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} hours`;

const getTransitionWarnings = (order, to) => {
  const warnings = [];
  const paidOk =
    order.paymentStatus === "paid" || order.paymentMethod.includes("cod");

  if ((to === "processing" || to === "shipped") && !paidOk) {
    warnings.push(
      `Payment status is "${label(
        order.paymentStatus || "not provided",
      )}". Confirm payment before fulfillment.`,
    );
  }
  if (to === "cancelled") {
    warnings.push(
      "Cancellation may affect inventory, refunds, and customer notifications.",
    );
  }
  if (to === "delivered") {
    warnings.push("Delivered is a final status and cannot be changed here.");
  }
  if (FINAL_STATUSES.has(order.status)) {
    warnings.push(
      `This order is already ${label(order.status).toLowerCase()}.`,
    );
  }
  return warnings;
};

/* Build the history row we show locally until the server data arrives. */
const localHistoryEntry = (existing, to, nowIso, text, suffix = "") => ({
  key: `local-${nowIso}${suffix}`,
  from: existing.status,
  to,
  at: nowIso,
  by: "You",
  note: text ?? "",
});

/* ------------------------------------------------------------------
   Presentational
------------------------------------------------------------------ */

function StatusBadge({ status }) {
  return <span className={`sa-badge ${status}`}>{label(status)}</span>;
}

function PaymentBadge({ status }) {
  if (!status) return <span className="muted">Not provided</span>;
  return <span className={`sa-badge pay-${status}`}>{label(status)}</span>;
}

function StatusStepper({ status }) {
  if (status === "cancelled") {
    return (
      <div className="orders-stepper-cancelled" role="status">
        <AlertCircle size={16} />
        This order was cancelled.
      </div>
    );
  }

  const currentIndex = FLOW.indexOf(status);

  return (
    <ol className="orders-stepper" aria-label="Order progress">
      {FLOW.map((step, index) => {
        const state =
          currentIndex === -1
            ? "todo"
            : index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "todo";

        return (
          <li
            key={step}
            className={`orders-step ${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="orders-step-dot" />
            <span className="orders-step-label">{label(step)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StatusHistory({ history }) {
  if (!history.length) {
    return <p className="muted">No status changes have been recorded.</p>;
  }

  return (
    <ul className="orders-history">
      {history.map((entry) => (
        <li key={entry.key} className="orders-history-item">
          <div>
            {entry.from ? (
              <>
                <StatusBadge status={entry.from} /> to{" "}
                <StatusBadge status={entry.to || "unknown"} />
              </>
            ) : (
              <StatusBadge status={entry.to || "unknown"} />
            )}
          </div>
          <small className="muted">
            {showDate(entry.at)}
            {entry.by ? ` by ${entry.by}` : ""}
          </small>
          {entry.note && <p className="orders-history-note">{entry.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------
   Main page
------------------------------------------------------------------ */

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [skipped, setSkipped] = useState(0);
  const [statusCounts, setStatusCounts] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null); // { text, jumpTo? }
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const [pending, setPending] = useState(null);
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");

  const [checked, setChecked] = useState(() => new Set());
  const [bulkTarget, setBulkTarget] = useState("");
  const [bulkPending, setBulkPending] = useState(null);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);

  const busyLock = useRef(false);
  const mounted = useRef(false);
  const committedSearch = useRef("");
  const lastParamsKey = useRef("");
  const selectedIdRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    selectedIdRef.current = selected ? String(selected.id) : null;
  }, [selected]);

  const busy = busyId !== null || bulkRunning;

  const flash = (text, jumpTo = null) => setNotice({ text, jumpTo });

  /* debounced search (no side effects inside state updaters) */
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim().slice(0, MAX_SEARCH_LENGTH);
      if (next !== committedSearch.current) {
        committedSearch.current = next;
        setSearch(next);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setChecked(new Set());
    setBulkTarget("");
  }, [page, tab, search]);

  /* load list. A refresh (refreshKey) keeps the current rows on screen;
     only a change of page/tab/search shows the full loading state. */
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const paramsKey = `${page}|${tab}|${search}`;
    const paramsChanged = paramsKey !== lastParamsKey.current;
    lastParamsKey.current = paramsKey;
    if (paramsChanged) setLoading(true);

    const run = async () => {
      try {
        const params = { page, limit: LIMIT };
        if (tab !== "all") params.status = tab;
        if (search) params.search = search;

        const response = await apiRequest(
          withQuery(`${ORDERS}/admin/all`, params),
          { signal },
        );

        if (signal.aborted) return;

        let bad = 0;
        const list = toList(response).reduce((result, raw) => {
          try {
            result.push(normalize(raw));
          } catch {
            bad += 1;
          }
          return result;
        }, []);

        const rawCount = list.length + bad;
        const paging = toPaging(response);

        const pagesValue = validNumber(
          paging.totalPages ?? paging.total_pages ?? paging.pageCount,
        );
        const totalValue = validNumber(
          paging.total ??
            paging.totalCount ??
            paging.total_count ??
            paging.count,
        );

        let pages = null;
        if (pagesValue !== null && pagesValue >= 1) {
          pages = Math.floor(pagesValue);
        } else if (totalValue !== null && totalValue >= 0) {
          pages = Math.max(1, Math.ceil(totalValue / LIMIT));
        }

        // Current page became empty (e.g. last order moved to another status).
        if (list.length === 0 && bad === 0 && page > 1) {
          setPage(pages ? Math.min(page - 1, pages) : page - 1);
          return;
        }

        setError((prev) => (paramsChanged ? "" : prev));
        setOrders(list);
        setSkipped(bad);
        setStatusCounts(toStatusCounts(response, paging));

        if (pages !== null) {
          setTotalPages(pages);
          setHasMore(page < pages);
        } else {
          setTotalPages(null);
          setHasMore(rawCount === LIMIT);
        }
      } catch (err) {
        if (err?.name !== "AbortError" && !signal.aborted) {
          setError(
            getErrorMessage(err, "Unable to load orders. Please try again."),
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void run();
    return () => controller.abort();
  }, [page, tab, search, refreshKey]);

  const reloadList = () => setRefreshKey((v) => v + 1);

  const refresh = () => {
    setNotice(null);
    setError("");
    setRefreshing(true);
    reloadList();
  };

  const changeTab = (status) => {
    if (status === tab) return;
    setTab(status);
    setPage(1);
    setNotice(null);
    setError("");
  };

  /* Re-fetch one order from the server and update the open detail modal. */
  const reloadDetail = useCallback(async (id) => {
    try {
      const response = await apiRequest(
        `${ORDERS}/admin/${encodeURIComponent(id)}`,
      );
      const full = getOrder(response);
      if (!mounted.current) return;
      setSelected((prev) =>
        prev && String(prev.id) === String(full.id) ? full : prev,
      );
      setOrders((prev) =>
        prev.map((item) =>
          String(item.id) === String(full.id)
            ? {
                ...item,
                status: full.status,
                statusChangedAt: full.statusChangedAt,
              }
            : item,
        ),
      );
    } catch {
      /* the list refresh will still show the latest state */
    }
  }, []);

  /* derived
     The server owns search; we only guard the status tab so a tab never
     shows rows of another status. Client-side search filtering was removed:
     it hid rows the server had legitimately matched. */
  const visible = useMemo(
    () => orders.filter((order) => tab === "all" || order.status === tab),
    [orders, tab],
  );

  const summary = useMemo(
    () => ({
      count: visible.length,
      pending: visible.filter((o) => o.status === "pending").length,
      processing: visible.filter((o) => o.status === "processing").length,
      delayed: visible.filter((o) => getDelayHours(o) !== null).length,
      value: visible.reduce((sum, o) => sum + (o.total ?? 0), 0),
    }),
    [visible],
  );

  const checkedOrders = useMemo(
    () => visible.filter((o) => checked.has(String(o.id))),
    [visible, checked],
  );

  const bulkOptions = useMemo(() => {
    if (checkedOrders.length === 0) return [];
    const first = checkedOrders[0].status;
    if (!checkedOrders.every((o) => o.status === first)) return [];
    const allowedForEveryOrder = allowedNext(checkedOrders[0]).filter(
      (status) =>
        checkedOrders.every((order) => allowedNext(order).includes(status)),
    );
    return allowedForEveryOrder.filter((status) => !NEEDS_INPUT.has(status));
  }, [checkedOrders]);

  const mixedSelection =
    checkedOrders.length > 1 &&
    !checkedOrders.every((o) => o.status === checkedOrders[0].status);

  const selectableRows = visible.filter((o) => allowedNext(o).length > 0);

  const allChecked =
    selectableRows.length > 0 &&
    selectableRows.every((o) => checked.has(String(o.id)));

  const toggleOne = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setBulkTarget("");
  };

  const toggleAll = () => {
    setChecked(
      allChecked ? new Set() : new Set(selectableRows.map((o) => String(o.id))),
    );
    setBulkTarget("");
  };

  /* open detail */
  const openOrder = async (order) => {
    if (openingId !== null) return;
    setError("");
    setNotice(null);
    setOpeningId(order.id);

    try {
      const response = await apiRequest(
        `${ORDERS}/admin/${encodeURIComponent(order.id)}`,
      );
      const full = getOrder(response);
      if (String(full.id) !== String(order.id)) {
        throw new Error("The server returned a different order.");
      }
      if (mounted.current) setSelected(full);
    } catch (err) {
      if (mounted.current) {
        setError(getErrorMessage(err, "Unable to load order details."));
      }
    } finally {
      if (mounted.current) setOpeningId(null);
    }
  };

  /* single status change */
  const requestChange = (order, to) => {
    if (busyLock.current || busy) return;
    if (!order || order.status === to) return;

    if (FINAL_STATUSES.has(order.status)) {
      setError(
        `Order #${order.id} is already ${label(
          order.status,
        ).toLowerCase()} and cannot be changed.`,
      );
      return;
    }

    if (!STATUSES.includes(to) || !allowedNext(order).includes(to)) {
      setError(
        `Changing from "${label(order.status)}" to "${label(to)}" is not allowed.`,
      );
      return;
    }

    setError("");
    setNotice(null);
    setFormError("");
    setTracking(order.trackingNumber || "");
    setReason("");
    setNote("");
    setPending({ order, to });
  };

  const closeConfirm = () => {
    if (busyId !== null) return;
    setPending(null);
    setFormError("");
  };

  const confirmChange = async () => {
    if (!pending || busyLock.current) return;

    const { order, to } = pending;

    if (FINAL_STATUSES.has(order.status) || !allowedNext(order).includes(to)) {
      setFormError(
        "This status transition is no longer allowed. Refresh and try again.",
      );
      return;
    }

    const body = {
      status: to,
      expectedStatus: order.status,
    };

    if (to === "shipped") {
      const value = tracking.trim();
      if (value.length < 3) {
        setFormError("Enter a tracking number (at least 3 characters).");
        return;
      }
      if (value.length > MAX_TRACKING_LENGTH) {
        setFormError("The tracking number is too long.");
        return;
      }
      body.trackingNumber = value;
    }

    if (to === "cancelled") {
      const value = reason.trim();
      if (value.length < 3) {
        setFormError("Enter a reason for cancelling this order.");
        return;
      }
      if (value.length > MAX_NOTE_LENGTH) {
        setFormError("The cancellation reason is too long.");
        return;
      }
      body.reason = value;
    }

    const trimmedNote = note.trim();
    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      setFormError("The internal note is too long.");
      return;
    }
    if (trimmedNote) body.note = trimmedNote;

    busyLock.current = true;
    setFormError("");
    setBusyId(order.id);

    try {
      await apiRequest(
        `${ORDERS}/admin/${encodeURIComponent(order.id)}/status`,
        { method: "PATCH", body },
      );

      if (!mounted.current) return;

      // Do not depend on the shape of the PATCH response: apply the change
      // locally, then let the server data (list + detail) overwrite it.
      const nowIso = new Date().toISOString();
      const patch = (existing) => ({
        ...existing,
        status: to,
        updatedAt: nowIso,
        statusChangedAt: nowIso,
        trackingNumber: body.trackingNumber ?? existing.trackingNumber,
        cancelReason: body.reason ?? existing.cancelReason,
        history: [
          localHistoryEntry(existing, to, nowIso, body.reason ?? body.note),
          ...existing.history,
        ],
      });

      setOrders((prev) =>
        prev.map((item) =>
          String(item.id) === String(order.id) ? patch(item) : item,
        ),
      );
      setSelected((prev) =>
        prev && String(prev.id) === String(order.id) ? patch(prev) : prev,
      );

      // If the order now belongs to another tab, tell the admin where it went.
      flash(
        `Order #${order.id} updated to ${label(to)}.`,
        tab !== "all" && tab !== to ? to : null,
      );
      setPending(null);
      reloadList();
      if (selectedIdRef.current === String(order.id)) {
        void reloadDetail(order.id);
      }
    } catch (err) {
      if (!mounted.current) return;

      if (isConflict(err)) {
        // 409: the stored status is not what this screen showed
        // (changed by another admin/process, or the server rejected the move).
        const serverMessage = getErrorMessage(err, "");
        setPending(null);
        setFormError("");
        setError(
          `Order #${order.id} could not be updated because its status changed or the move was rejected. The latest data was reloaded — check the status and try again.${
            serverMessage && !/conflict/i.test(serverMessage)
              ? ` Server: ${serverMessage}`
              : ""
          }`,
        );
        reloadList();
        if (selectedIdRef.current === String(order.id)) {
          void reloadDetail(order.id);
        }
      } else {
        setFormError(
          getErrorMessage(err, "Unable to update the order status."),
        );
      }
    } finally {
      busyLock.current = false;
      if (mounted.current) setBusyId(null);
    }
  };

  /* bulk */
  const requestBulk = () => {
    if (busyLock.current || busy) return;
    if (!bulkTarget || checkedOrders.length === 0) return;
    if (!bulkOptions.includes(bulkTarget)) {
      setError("The selected orders cannot all be moved to that status.");
      return;
    }
    setError("");
    setNotice(null);
    setBulkNote("");
    setBulkDone(0);
    setBulkPending({ orders: checkedOrders, to: bulkTarget });
  };

  const closeBulk = () => {
    if (bulkRunning) return;
    setBulkPending(null);
  };

  const confirmBulk = async () => {
    if (!bulkPending || busyLock.current) return;

    const { orders: targets, to } = bulkPending;
    const trimmedNote = bulkNote.trim();

    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      setError("The internal note is too long.");
      return;
    }

    const sameStatus = targets.every((o) => o.status === targets[0]?.status);
    const valid =
      sameStatus &&
      targets.length > 0 &&
      targets.every(
        (o) => !FINAL_STATUSES.has(o.status) && allowedNext(o).includes(to),
      );

    if (!valid || NEEDS_INPUT.has(to)) {
      setError(
        "These orders cannot be updated together. Select orders with the same status that do not need tracking or a cancellation reason.",
      );
      setBulkPending(null);
      return;
    }

    busyLock.current = true;
    setBulkRunning(true);
    setBulkDone(0);
    setError("");

    const succeeded = [];
    const failed = [];
    const nowIso = new Date().toISOString();

    try {
      for (const order of targets) {
        if (!mounted.current) break;

        try {
          const body = {
            status: to,
            expectedStatus: order.status,
          };
          if (trimmedNote) body.note = trimmedNote;

          await apiRequest(
            `${ORDERS}/admin/${encodeURIComponent(order.id)}/status`,
            { method: "PATCH", body },
          );
          succeeded.push(String(order.id));
        } catch (err) {
          failed.push({
            id: order.id,
            message: getErrorMessage(err, "Update failed."),
            conflict: isConflict(err),
          });
        }

        if (mounted.current) setBulkDone((v) => v + 1);
      }
    } finally {
      busyLock.current = false;
    }

    if (!mounted.current) return;

    if (succeeded.length > 0) {
      const doneSet = new Set(succeeded);
      setOrders((prev) =>
        prev.map((item) =>
          doneSet.has(String(item.id))
            ? {
                ...item,
                status: to,
                updatedAt: nowIso,
                statusChangedAt: nowIso,
                history: [
                  localHistoryEntry(
                    item,
                    to,
                    nowIso,
                    trimmedNote,
                    `-${item.id}`,
                  ),
                  ...item.history,
                ],
              }
            : item,
        ),
      );
      if (selectedIdRef.current && doneSet.has(selectedIdRef.current)) {
        void reloadDetail(selectedIdRef.current);
      }
    }

    // Always reload: failures may mean the server state differs from the UI.
    reloadList();

    setChecked(new Set(failed.map((f) => String(f.id))));
    setBulkTarget("");
    setBulkRunning(false);
    setBulkPending(null);

    if (succeeded.length > 0) {
      flash(
        `${succeeded.length} order${succeeded.length === 1 ? "" : "s"} updated to ${label(to)}.`,
        tab !== "all" && tab !== to ? to : null,
      );
    }

    if (failed.length > 0) {
      const conflictCount = failed.filter((f) => f.conflict).length;
      const ids = failed
        .slice(0, 5)
        .map((f) => `#${f.id}`)
        .join(", ");
      setError(
        `${failed.length} order${failed.length === 1 ? "" : "s"} could not be updated (${ids}${
          failed.length > 5 ? ", ..." : ""
        }).${
          conflictCount
            ? ` ${conflictCount} had a conflict (status already changed or move rejected).`
            : ""
        } First error: ${failed[0].message}`,
      );
    }
  };

  /* status select – ALL statuses visible, illegal ones disabled */
  const statusSelect = (order, className = "") => {
    const next = allowedNext(order);
    const locked =
      FINAL_STATUSES.has(order.status) ||
      next.length === 0 ||
      !STATUSES.includes(order.status);

    return (
      <select
        className={className}
        value={order.status}
        disabled={busy || locked}
        title={
          locked
            ? "This status cannot be changed."
            : "Only allowed next statuses can be selected."
        }
        onChange={(e) => {
          const to = e.target.value;
          if (to === order.status) return;
          if (!next.includes(to)) {
            setError(
              `Cannot change from "${label(order.status)}" to "${label(to)}".`,
            );
            return;
          }
          requestChange(order, to);
        }}
        aria-label={`Status for order ${order.id}`}
      >
        <option value={order.status}>{label(order.status)}</option>
        {STATUSES.filter((s) => s !== order.status).map((status) => {
          const allowed = next.includes(status);
          return (
            <option
              key={status}
              value={status}
              disabled={!allowed}
              title={
                allowed ? undefined : `Not allowed from ${label(order.status)}`
              }
            >
              {label(status)}
              {!allowed ? " (not allowed)" : ""}
            </option>
          );
        })}
      </select>
    );
  };

  const warnings = pending
    ? getTransitionWarnings(pending.order, pending.to)
    : [];

  const tabCount = (status) => {
    if (!statusCounts) return null;
    if (status === "all") {
      if (statusCounts.all != null) return statusCounts.all;
      return Object.entries(statusCounts)
        .filter(([k]) => k !== "all")
        .reduce((sum, [, v]) => sum + v, 0);
    }
    return statusCounts[status] ?? null;
  };

  /* render */
  return (
    <>
      <div className="sa-page-head">
        <div>
          <h1>Orders</h1>
          <p>Review customer purchases, payments, and fulfillment.</p>
        </div>
        <button
          type="button"
          className="sa-btn ghost"
          onClick={refresh}
          disabled={loading || refreshing || busy}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="orders-alert orders-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={refresh}>
            Retry
          </button>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="orders-alert orders-alert-success" role="status">
          <span>{notice.text}</span>
          {notice.jumpTo && (
            <button type="button" onClick={() => changeTab(notice.jumpTo)}>
              View {label(notice.jumpTo)} orders
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {skipped > 0 && (
        <div className="orders-alert orders-alert-error" role="status">
          <AlertTriangle size={18} />
          <span>
            {skipped} order{skipped === 1 ? "" : "s"} on this page could not be
            displayed because the data was invalid.
          </span>
        </div>
      )}

      <div className="orders-summary">
        <div className="sa-card orders-summary-card">
          <div className="orders-summary-icon">
            <ShoppingBag size={20} />
          </div>
          <div>
            <p>Orders on this page</p>
            <strong>{summary.count}</strong>
          </div>
        </div>
        <div className="sa-card orders-summary-card">
          <div className="orders-summary-icon">
            <Clock3 size={20} />
          </div>
          <div>
            <p>Pending on this page</p>
            <strong>{summary.pending}</strong>
          </div>
        </div>
        <div className="sa-card orders-summary-card">
          <div className="orders-summary-icon">
            <Package size={20} />
          </div>
          <div>
            <p>Processing on this page</p>
            <strong>{summary.processing}</strong>
          </div>
        </div>
        <div className="sa-card orders-summary-card">
          <div className="orders-summary-icon">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p>Delayed on this page</p>
            <strong>{summary.delayed}</strong>
          </div>
        </div>
        <div className="sa-card orders-summary-card">
          <div className="orders-summary-icon">
            <CircleDollarSign size={20} />
          </div>
          <div>
            <p>Order value on this page</p>
            <strong>
              {money(summary.value, visible[0]?.currency ?? "USD")}
            </strong>
          </div>
        </div>
      </div>

      <div className="sa-card">
        <div className="pg-toolbar">
          <label className="pg-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search by ID, customer, email, or tracking..."
              value={query}
              maxLength={MAX_SEARCH_LENGTH}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search orders"
            />
          </label>
        </div>

        <div className="pg-tabs orders-tabs" role="tablist">
          {["all", ...STATUSES].map((status) => {
            const count = tabCount(status);
            return (
              <button
                type="button"
                key={status}
                role="tab"
                className={tab === status ? "active" : ""}
                aria-selected={tab === status}
                onClick={() => changeTab(status)}
              >
                {label(status)}
                {count !== null && (
                  <span className="orders-tab-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {checkedOrders.length > 0 && (
          <div
            className="orders-bulkbar"
            role="region"
            aria-label="Bulk actions"
          >
            <span>
              <strong>{checkedOrders.length}</strong> selected
            </span>
            {mixedSelection ? (
              <span className="muted">
                Select orders with the same status to update them together.
              </span>
            ) : bulkOptions.length === 0 ? (
              <span className="muted">
                These orders need individual updates or have no shared allowed
                transition.
              </span>
            ) : (
              <>
                <select
                  value={bulkTarget}
                  onChange={(e) => setBulkTarget(e.target.value)}
                  disabled={busy}
                  aria-label="Move selected orders to status"
                >
                  <option value="">Move to...</option>
                  {bulkOptions.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="sa-btn"
                  onClick={requestBulk}
                  disabled={!bulkTarget || busy}
                >
                  Update selected
                </button>
              </>
            )}
            <button
              type="button"
              className="sa-btn ghost"
              onClick={() => {
                setChecked(new Set());
                setBulkTarget("");
              }}
              disabled={busy}
            >
              Clear selection
            </button>
          </div>
        )}

        <div className="pg-table-wrap">
          <table className="sa-table pg-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    disabled={busy || selectableRows.length === 0}
                    aria-label="Select all orders that can be updated"
                  />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Placed</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="r">Details</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                visible.map((order) => {
                  const delay = getDelayHours(order);
                  const final =
                    allowedNext(order).length === 0 ||
                    FINAL_STATUSES.has(order.status);

                  return (
                    <tr key={order.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked.has(String(order.id))}
                          onChange={() => toggleOne(order.id)}
                          disabled={busy || final}
                          aria-label={`Select order ${order.id}`}
                        />
                      </td>
                      <td>
                        <strong>#{order.id}</strong>
                      </td>
                      <td>
                        <div>{order.customer}</div>
                        {order.email && (
                          <small className="muted">{order.email}</small>
                        )}
                      </td>
                      <td>{showDate(order.date)}</td>
                      <td>{money(order.total, order.currency)}</td>
                      <td>
                        <PaymentBadge status={order.paymentStatus} />
                      </td>
                      <td>
                        {statusSelect(
                          order,
                          `pg-status sa-badge ${order.status}`,
                        )}
                        {delay !== null && (
                          <small
                            className="orders-delay"
                            title={`In ${label(order.status)} for ${formatDelay(delay)}`}
                          >
                            <AlertTriangle size={12} />
                            Delayed {formatDelay(delay)}
                          </small>
                        )}
                      </td>
                      <td className="r">
                        <button
                          type="button"
                          className="sa-icon-btn"
                          aria-label={`View order ${order.id}`}
                          title="View order details"
                          disabled={openingId !== null}
                          onClick={() => openOrder(order)}
                        >
                          {String(openingId) === String(order.id) ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {loading && (
            <p className="pg-empty" role="status">
              <Loader2 size={18} className="animate-spin" />
              Loading orders...
            </p>
          )}

          {!loading && visible.length === 0 && (
            <p className="pg-empty">
              {tab !== "all" || search
                ? "No orders match your search and selected status."
                : "No orders are available."}
            </p>
          )}
        </div>

        <div
          className="pg-toolbar orders-pagination"
          aria-label="Orders pagination"
        >
          <span className="muted">
            Page {page}
            {totalPages !== null ? ` of ${totalPages}` : ""}
          </span>
          <div className="orders-pagination-actions">
            <button
              type="button"
              className="sa-btn ghost"
              disabled={page <= 1 || loading || busy}
              onClick={() => {
                setPage((c) => Math.max(1, c - 1));
                setError("");
                setNotice(null);
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="sa-btn ghost"
              disabled={!hasMore || loading || busy}
              onClick={() => {
                setPage((c) => c + 1);
                setError("");
                setNotice(null);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <Modal
          title={`Order #${selected.id}`}
          onClose={() => {
            if (!busy && !pending) setSelected(null);
          }}
        >
          <div className="orders-detail">
            <section className="orders-detail-section">
              <h3>Progress</h3>
              <StatusStepper status={selected.status} />
              {selected.status === "cancelled" && selected.cancelReason && (
                <p>
                  <strong>Cancellation reason:</strong> {selected.cancelReason}
                </p>
              )}
              {(() => {
                const delay = getDelayHours(selected);
                return delay !== null ? (
                  <p className="orders-delay">
                    <AlertTriangle size={14} />
                    This order has been {label(
                      selected.status,
                    ).toLowerCase()}{" "}
                    for {formatDelay(delay)}.
                  </p>
                ) : null;
              })()}
            </section>

            <section className="orders-detail-section">
              <h3>Customer</h3>
              <p>
                <strong>{selected.customer}</strong>
              </p>
              <p className="muted">{selected.email || "Email not provided"}</p>
              <p className="muted">{selected.phone || "Phone not provided"}</p>
            </section>

            <section className="orders-detail-section">
              <h3>Order information</h3>
              <p>
                <strong>Placed:</strong> {showDate(selected.date)}
              </p>
              {selected.updatedAt && (
                <p>
                  <strong>Last updated:</strong> {showDate(selected.updatedAt)}
                </p>
              )}
              <p>
                <strong>Order status:</strong>{" "}
                <StatusBadge status={selected.status} />
              </p>
              <p>
                <strong>Payment status:</strong>{" "}
                <PaymentBadge status={selected.paymentStatus} />
              </p>
              <p>
                <strong>Payment method:</strong>{" "}
                {selected.paymentMethod
                  ? label(selected.paymentMethod)
                  : "Not provided"}
              </p>
            </section>

            <section className="orders-detail-section">
              <h3>
                <MapPin size={17} /> Delivery
              </h3>
              <p>
                {selected.shippingAddress || "Shipping address not provided"}
              </p>
              {selected.shippingMethod && (
                <p>
                  <strong>Shipping method:</strong>{" "}
                  {label(selected.shippingMethod)}
                </p>
              )}
              {selected.trackingNumber && (
                <p>
                  <strong>Tracking number:</strong> {selected.trackingNumber}
                </p>
              )}
            </section>

            {selected.notes && (
              <section className="orders-detail-section">
                <h3>Customer note</h3>
                <p>{selected.notes}</p>
              </section>
            )}

            <section className="orders-detail-section">
              <h3>Items ({selected.items.length})</h3>
              <div className="orders-lines">
                {selected.items.map((item) => {
                  const lineTotal =
                    item.price !== null && item.quantity !== null
                      ? item.price * item.quantity
                      : null;
                  return (
                    <div className="orders-line" key={item.key}>
                      <div className="orders-line-info">
                        <strong>{item.name}</strong>
                        {(item.sku || item.size || item.color) && (
                          <small className="muted">
                            {[
                              item.sku && `SKU: ${item.sku}`,
                              item.size && `Size: ${item.size}`,
                              item.color && `Color: ${item.color}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
                        <small className="muted">
                          {item.quantity === null
                            ? "Quantity unavailable"
                            : `Quantity: ${item.quantity}`}
                          {item.price !== null
                            ? ` · ${money(item.price, selected.currency)} each`
                            : ""}
                        </small>
                      </div>
                      <strong>{money(lineTotal, selected.currency)}</strong>
                    </div>
                  );
                })}
                <div className="orders-total-line">
                  <span>Order total</span>
                  <strong>{money(selected.total, selected.currency)}</strong>
                </div>
              </div>
            </section>

            <section className="orders-detail-section">
              <h3>
                <History size={17} /> Status history
              </h3>
              <StatusHistory history={selected.history} />
            </section>

            <section className="orders-detail-section">
              <h3>
                <CreditCard size={17} /> Update order status
              </h3>
              <p className="muted">
                {allowedNext(selected).length === 0
                  ? "This status is final and cannot be changed."
                  : "You will be asked to confirm before the change is saved."}
              </p>
              <label className="pg-field">
                Status
                {statusSelect(selected, "")}
              </label>
              {busyId !== null && (
                <p className="muted" role="status">
                  <Loader2 size={15} className="animate-spin" />
                  Updating order...
                </p>
              )}
            </section>
          </div>
        </Modal>
      )}

      {/* Confirm single change */}
      {pending && (
        <Modal title="Confirm status change" onClose={closeConfirm}>
          <div className="orders-detail">
            <section className="orders-detail-section">
              <p>
                Change order <strong>#{pending.order.id}</strong> from{" "}
                <strong>{label(pending.order.status)}</strong> to{" "}
                <strong>{label(pending.to)}</strong>?
              </p>

              {warnings.map((w) => (
                <p key={w} className="muted" role="note">
                  <AlertTriangle size={15} />
                  {w}
                </p>
              ))}

              {pending.to === "shipped" && (
                <label className="pg-field">
                  Tracking number
                  <input
                    type="text"
                    value={tracking}
                    maxLength={MAX_TRACKING_LENGTH}
                    onChange={(e) => setTracking(e.target.value)}
                    disabled={busyId !== null}
                    autoFocus
                    required
                  />
                </label>
              )}

              {pending.to === "cancelled" && (
                <label className="pg-field">
                  Reason for cancellation
                  <textarea
                    rows={3}
                    value={reason}
                    maxLength={MAX_NOTE_LENGTH}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busyId !== null}
                    autoFocus
                    required
                  />
                </label>
              )}

              <label className="pg-field">
                Internal note (optional)
                <textarea
                  rows={2}
                  value={note}
                  maxLength={MAX_NOTE_LENGTH}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busyId !== null}
                />
              </label>

              {formError && (
                <p className="orders-alert orders-alert-error" role="alert">
                  <AlertCircle size={16} />
                  {formError}
                </p>
              )}

              <div className="orders-pagination-actions">
                <button
                  type="button"
                  className="sa-btn ghost"
                  onClick={closeConfirm}
                  disabled={busyId !== null}
                >
                  Keep current status
                </button>
                <button
                  type="button"
                  className="sa-btn"
                  onClick={confirmChange}
                  disabled={busyId !== null}
                >
                  {busyId !== null ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    `Confirm ${label(pending.to)}`
                  )}
                </button>
              </div>
            </section>
          </div>
        </Modal>
      )}

      {/* Confirm bulk */}
      {bulkPending && (
        <Modal title="Confirm bulk update" onClose={closeBulk}>
          <div className="orders-detail">
            <section className="orders-detail-section">
              <p>
                Move <strong>{bulkPending.orders.length}</strong> order
                {bulkPending.orders.length === 1 ? "" : "s"} from{" "}
                <strong>{label(bulkPending.orders[0]?.status)}</strong> to{" "}
                <strong>{label(bulkPending.to)}</strong>?
              </p>
              <p className="muted">
                Orders:{" "}
                {bulkPending.orders
                  .slice(0, 8)
                  .map((o) => `#${o.id}`)
                  .join(", ")}
                {bulkPending.orders.length > 8
                  ? ` and ${bulkPending.orders.length - 8} more`
                  : ""}
              </p>

              {bulkPending.orders.some(
                (o) => getTransitionWarnings(o, bulkPending.to).length,
              ) && (
                <p className="muted" role="note">
                  <AlertTriangle size={15} />
                  Some orders have warnings. The server validates each change.
                </p>
              )}

              <label className="pg-field">
                Internal note (optional)
                <textarea
                  rows={2}
                  value={bulkNote}
                  maxLength={MAX_NOTE_LENGTH}
                  onChange={(e) => setBulkNote(e.target.value)}
                  disabled={bulkRunning}
                />
              </label>

              {bulkRunning && (
                <p className="muted" role="status">
                  <Loader2 size={15} className="animate-spin" />
                  Updated {bulkDone} of {bulkPending.orders.length}...
                </p>
              )}

              <div className="orders-pagination-actions">
                <button
                  type="button"
                  className="sa-btn ghost"
                  onClick={closeBulk}
                  disabled={bulkRunning}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sa-btn"
                  onClick={confirmBulk}
                  disabled={bulkRunning}
                >
                  {bulkRunning
                    ? "Updating..."
                    : `Move to ${label(bulkPending.to)}`}
                </button>
              </div>
            </section>
          </div>
        </Modal>
      )}
    </>
  );
}
