import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Minus,
  Plus,
  Package,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import "./css/AdminPages.css";
import { apiRequest, withQuery } from "../../src/lib/api";

const INVENTORY = "/api/inventory";
const LIMIT = 20;

const stateOf = (stock, threshold) =>
  stock <= 0 ? "out" : stock <= threshold ? "low" : "ok";

const label = {
  ok: "In stock",
  low: "Low stock",
  out: "Out of stock",
};

const unwrap = (res) => {
  let value = res;

  for (let i = 0; i < 3; i += 1) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.data !== undefined
    ) {
      value = value.data;
    } else {
      break;
    }
  }

  return value;
};

const toList = (res) => {
  const data = unwrap(res);

  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    for (const key of ["inventory", "items", "rows", "variants"]) {
      if (Array.isArray(data[key])) return data[key];
    }
  }

  throw new Error("The server returned an unexpected inventory response.");
};

const toPaging = (res) => {
  const data = unwrap(res);
  const candidates = [
    res?.pagination,
    res?.meta,
    res?.data?.pagination,
    res?.data?.meta,
    data?.pagination,
    data?.meta,
    data,
  ];

  return (
    candidates.find(
      (value) =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (value.totalPages != null ||
          value.total_pages != null ||
          value.total_pages_count != null),
    ) ?? {}
  );
};

const normalize = (row) => {
  if (!row || typeof row !== "object") {
    throw new Error("The server returned an invalid inventory item.");
  }

  const id = row.product_variant_id ?? row.variant_id ?? row.id;

  if (id == null || id === "") {
    throw new Error("An inventory item is missing its variant ID.");
  }

  const rawStock = row.stock_quantity ?? row.stock ?? row.quantity ?? 0;

  const rawThreshold = row.low_stock_threshold ?? row.threshold ?? 5;

  const stock = Number(rawStock);
  const threshold = Number(rawThreshold);

  return {
    id,
    name: row.product_name ?? row.name ?? "",
    sku: row.sku ?? "",
    stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
    threshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : 5,
  };
};

const banner = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  marginBottom: 16,
};

const getErrorMessage = (err, fallback) =>
  typeof err?.message === "string" && err.message.trim()
    ? err.message
    : fallback;

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);

  // Debounce search requests and reset to the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (signal) => {
      setError("");

      try {
        const res = await apiRequest(
          withQuery(INVENTORY, {
            page,
            limit: LIMIT,
            search,
          }),
          { signal },
        );

        const rows = toList(res);
        const paging = toPaging(res);

        const normalized = rows.map(normalize);

        setItems(normalized);

        const pages = Number(
          paging.totalPages ??
            paging.total_pages ??
            paging.total_pages_count ??
            1,
        );

        setTotalPages(
          Number.isFinite(pages) && pages >= 1 ? Math.floor(pages) : 1,
        );

        setDrafts({});
      } catch (err) {
        if (err?.name !== "AbortError" && !signal?.aborted) {
          setError(getErrorMessage(err, "Failed to load inventory."));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [page, search],
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    load(controller.signal);

    return () => controller.abort();
  }, [load]);

  // Summary counts reflect the current page.
  const counts = useMemo(() => {
    const result = { ok: 0, low: 0, out: 0 };

    items.forEach((item) => {
      result[stateOf(item.stock, item.threshold)] += 1;
    });

    return result;
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter(
        (item) => tab === "all" || stateOf(item.stock, item.threshold) === tab,
      ),
    [items, tab],
  );

  // Adjust stock and use the response when it includes a stock value.
  const adjust = async (id, delta) => {
    const numericDelta = Number(delta);

    if (
      !Number.isFinite(numericDelta) ||
      !Number.isInteger(numericDelta) ||
      numericDelta === 0 ||
      busyId !== null
    ) {
      return;
    }

    const current = items.find((item) => String(item.id) === String(id));

    if (!current) return;

    if (current.stock + numericDelta < 0) {
      setError("Stock cannot go below zero.");
      setDrafts((draft) => {
        const { [id]: removed, ...rest } = draft;
        return rest;
      });
      return;
    }

    setError("");
    setBusyId(String(id));

    try {
      const res = await apiRequest(`${INVENTORY}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { delta: numericDelta },
      });

      const data = unwrap(res);

      // Some APIs return the complete updated item; others return
      // only a success message. Keep the existing item as a fallback.
      const hasStock =
        data &&
        typeof data === "object" &&
        (data.stock_quantity != null ||
          data.stock != null ||
          data.quantity != null);

      const updated = hasStock
        ? normalize({
            ...current,
            ...data,
            product_variant_id:
              data.product_variant_id ??
              data.variant_id ??
              data.id ??
              current.id,
            stock_quantity: data.stock_quantity ?? data.stock ?? data.quantity,
            low_stock_threshold: data.low_stock_threshold ?? current.threshold,
          })
        : {
            ...current,
            stock: current.stock + numericDelta,
          };

      setItems((list) =>
        list.map((item) => (String(item.id) === String(id) ? updated : item)),
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update stock."));
    } finally {
      setBusyId(null);

      setDrafts((draft) => {
        const { [id]: removed, ...rest } = draft;
        return rest;
      });
    }
  };

  // Apply a typed quantity when the input loses focus.
  const applyDraft = (item) => {
    const raw = drafts[item.id];

    if (raw === undefined) return;

    const text = String(raw).trim();
    const target = Number(text);

    if (
      text === "" ||
      !Number.isFinite(target) ||
      !Number.isInteger(target) ||
      target < 0
    ) {
      setDrafts((draft) => {
        const { [item.id]: removed, ...rest } = draft;
        return rest;
      });
      return;
    }

    const delta = target - item.stock;

    if (delta === 0) {
      setDrafts((draft) => {
        const { [item.id]: removed, ...rest } = draft;
        return rest;
      });
      return;
    }

    adjust(item.id, delta);
  };

  const tabs = [
    ["all", "All"],
    ["low", "Low stock"],
    ["out", "Out of stock"],
  ];

  return (
    <>
      <div className="sa-page-head">
        <h1>Inventory</h1>
        <p>Track and adjust your stock levels</p>
      </div>

      {error && (
        <div style={banner} role="alert">
          {error}
        </div>
      )}

      <section className="pg-summary">
        <div className="sa-card sa-stat">
          <div className="sa-stat-top">
            <span>In stock</span>
            <span className="sa-stat-icon green">
              <Package size={18} />
            </span>
          </div>
          <strong>{counts.ok}</strong>
        </div>

        <div className="sa-card sa-stat">
          <div className="sa-stat-top">
            <span>Low stock</span>
            <span className="sa-stat-icon red">
              <AlertTriangle size={18} />
            </span>
          </div>
          <strong>{counts.low}</strong>
        </div>

        <div className="sa-card sa-stat">
          <div className="sa-stat-top">
            <span>Out of stock</span>
            <span className="sa-stat-icon red">
              <XCircle size={18} />
            </span>
          </div>
          <strong>{counts.out}</strong>
        </div>
      </section>

      <div className="sa-card">
        <div className="pg-toolbar">
          <label className="pg-search">
            <Search size={16} />
            <input
              placeholder="Search by name or SKU..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="pg-tabs">
            {tabs.map(([key, text]) => (
              <button
                key={key}
                type="button"
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div className="pg-table-wrap">
          <table className="sa-table pg-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Level</th>
                <th>Status</th>
                <th className="r">Adjust stock</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((item) => {
                const status = stateOf(item.stock, item.threshold);

                const busy = String(busyId) === String(item.id);

                const progress =
                  item.stock <= 0
                    ? 0
                    : Math.min(
                        100,
                        (item.stock / (Math.max(item.threshold, 1) * 4)) * 100,
                      );

                return (
                  <tr key={item.id}>
                    <td>
                      <span className="sa-thumb">
                        <Package size={18} />
                      </span>
                      {item.name}
                    </td>

                    <td>{item.sku}</td>

                    <td>
                      <div className="pg-bar" title={`${item.stock} units`}>
                        <span
                          className={status}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <small className="pg-units">{item.stock} units</small>
                    </td>

                    <td>
                      <span className={`sa-badge ${status}`}>
                        {label[status]}
                      </span>
                    </td>

                    <td className="r">
                      <div className="pg-stepper">
                        <button
                          type="button"
                          aria-label={`Decrease stock for ${item.name}`}
                          disabled={busy || busyId !== null || item.stock <= 0}
                          onClick={() => adjust(item.id, -1)}
                        >
                          <Minus size={14} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={drafts[item.id] ?? item.stock}
                          disabled={busy || busyId !== null}
                          onChange={(event) =>
                            setDrafts((draft) => ({
                              ...draft,
                              [item.id]: event.target.value,
                            }))
                          }
                          onBlur={() => applyDraft(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                          aria-label={`Stock for ${item.name} ${item.sku}`}
                        />

                        <button
                          type="button"
                          aria-label={`Increase stock for ${item.name}`}
                          disabled={busy || busyId !== null}
                          onClick={() => adjust(item.id, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && <p className="pg-empty">Loading inventory...</p>}

          {!loading && visible.length === 0 && (
            <p className="pg-empty">Nothing to show.</p>
          )}
        </div>

        <div className="pg-toolbar" style={{ marginTop: 14, marginBottom: 0 }}>
          <span className="muted">
            Page {page} of {totalPages}
          </span>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="sa-btn ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>

            <button
              type="button"
              className="sa-btn ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
