import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  Banknote,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Plus,
  RefreshCw,
} from "lucide-react";

import productsApi from "../../lib/productsApi.js";
import ordersApi from "../../lib/ordersApi.js";
import inventoryApi from "../../lib/inventoryApi.js";
import "./DashBoard.css";

const REQUEST_LIMIT = 100;
const LOW_STOCK_LIMIT = 5;

const RANGES = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
];

const number = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const result = number(value);
    if (result !== null) return result;
  }

  return 0;
};

const money = (value) =>
  `ETB ${Number(value || 0).toLocaleString("en-ET", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-ET", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getId = (item) =>
  item?.id ??
  item?.order_id ??
  item?.product_id ??
  item?.product_variant_id ??
  null;

const getStatus = (item) =>
  String(item?.status ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

const getOrderDate = (order) =>
  order?.created_at ??
  order?.createdAt ??
  order?.order_date ??
  order?.ordered_at ??
  order?.date ??
  null;

const getOrderTotal = (order) =>
  firstNumber(
    order?.grand_total,
    order?.total_amount,
    order?.total,
    order?.amount,
    order?.order_total,
  );

const getOrderCustomer = (order) => {
  const customer = order?.customer ?? order?.user ?? order?.buyer;

  if (typeof customer === "string") return customer;

  const fullName = [customer?.first_name, customer?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    customer?.name ||
    fullName ||
    order?.customer_name ||
    order?.user_name ||
    order?.shipping_name ||
    order?.email ||
    "Customer"
  );
};

const unwrapList = (response, resource) => {
  if (Array.isArray(response)) return response;

  const candidates = [
    response?.[resource],
    response?.data?.[resource],
    response?.data?.items,
    response?.data?.results,
    response?.data?.rows,
    response?.items,
    response?.results,
    response?.rows,
    response?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const unwrapTotal = (response, resource) => {
  const candidates = [
    response?.pagination?.total,
    response?.meta?.total,
    response?.data?.pagination?.total,
    response?.data?.meta?.total,
    response?.total,
    response?.total_count,
    response?.totalCount,
    response?.data?.total,
    response?.data?.total_count,
    response?.data?.totalCount,
  ];

  for (const candidate of candidates) {
    const parsed = number(candidate);

    if (parsed !== null && parsed >= 0) {
      return parsed;
    }
  }

  const resourceValue = response?.[resource];

  if (
    resourceValue &&
    !Array.isArray(resourceValue) &&
    typeof resourceValue === "object"
  ) {
    const parsed = number(resourceValue.total);

    if (parsed !== null && parsed >= 0) {
      return parsed;
    }
  }

  return null;
};

const fetchList = async (request, resource) => {
  const response = await request({
    page: 1,
    limit: REQUEST_LIMIT,
  });

  const items = unwrapList(response, resource);
  const total = unwrapTotal(response, resource);

  return {
    items: items.filter((item) => item && typeof item === "object"),
    total,
    truncated: total !== null && total > items.length,
  };
};

const getInventoryStock = (item) =>
  number(
    item?.stock_quantity ??
      item?.quantity_available ??
      item?.quantity ??
      item?.stock,
  );

const getStockThreshold = (item) =>
  firstNumber(
    item?.low_stock_threshold,
    item?.lowStockThreshold,
    LOW_STOCK_LIMIT,
  );

const isActiveProduct = (product) =>
  product?.is_active !== false &&
  product?.is_active !== 0 &&
  product?.is_active !== "0";

const isCancelled = (order) =>
  ["cancelled", "canceled", "refunded", "failed"].includes(getStatus(order));

// Adapt this to your actual payment and order-status rules.
const isRevenueOrder = (order) =>
  ["paid", "completed", "delivered"].includes(getStatus(order));

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const daysAgo = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const percentChange = (current, previous) => {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return Math.round(((current - previous) / previous) * 100);
};

const getPeriod = (orders, days, today) => {
  const currentStart = daysAgo(today, days - 1);
  const previousStart = daysAgo(today, days * 2 - 1);

  const currentEnd = daysAgo(today, -1);

  const current = [];
  const previous = [];

  for (const order of orders) {
    const rawDate = getOrderDate(order);
    if (!rawDate) continue;

    const date = new Date(rawDate);

    if (Number.isNaN(date.getTime())) continue;

    if (date >= currentStart && date < currentEnd) {
      current.push(order);
    } else if (date >= previousStart && date < currentStart) {
      previous.push(order);
    }
  }

  return { current, previous };
};

const confirmedRevenue = (orders) =>
  orders
    .filter(isRevenueOrder)
    .reduce((total, order) => total + getOrderTotal(order), 0);

const makeSalesSeries = (orders, days, today) => {
  const totals = new Map();

  for (let index = 0; index < days; index += 1) {
    const date = daysAgo(today, days - 1 - index);
    totals.set(dateKey(date), 0);
  }

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;

    const rawDate = getOrderDate(order);
    if (!rawDate) continue;

    const date = new Date(rawDate);

    if (Number.isNaN(date.getTime())) continue;

    const key = dateKey(date);

    if (!totals.has(key)) continue;

    totals.set(key, totals.get(key) + getOrderTotal(order));
  }

  return Array.from(totals, ([key, value]) => {
    const date = new Date(`${key}T12:00:00`);

    return {
      key,
      label: new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
      }).format(date),
      value,
    };
  });
};

function SalesChart({ data, loading }) {
  const reactId = useId();
  const gradientId = `sales-fill-${reactId.replace(/:/g, "")}`;

  if (loading) {
    return <p className="pg-empty">Loading sales data…</p>;
  }

  if (!data.length) {
    return <p className="pg-empty">No sales data available.</p>;
  }

  const W = 560;
  const H = 220;
  const P = { t: 16, r: 16, b: 32, l: 66 };

  const maxValue = Math.max(0, ...data.map((item) => item.value));

  const max = maxValue > 0 ? maxValue * 1.15 : 1;

  const x = (index) =>
    data.length === 1
      ? W / 2
      : P.l + (index * (W - P.l - P.r)) / (data.length - 1);

  const y = (value) => P.t + (1 - value / max) * (H - P.t - P.b);

  const line = data
    .map(
      (item, index) =>
        `${index === 0 ? "M" : "L"} ${x(index)} ${y(item.value)}`,
    )
    .join(" ");

  const area =
    `${line} L ${x(data.length - 1)} ${H - P.b} ` + `L ${x(0)} ${H - P.b} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max * fraction);

  const labelInterval = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="sa-chart"
        role="img"
        aria-label="Daily confirmed revenue in Ethiopian birr"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick, index) => (
          <g key={index}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
            />

            <text
              x={P.l - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              {tick.toLocaleString("en-ET", {
                notation: "compact",
                maximumFractionDigits: 1,
              })}
            </text>
          </g>
        ))}

        {maxValue > 0 && (
          <>
            <path d={area} fill={`url(#${gradientId})`} />

            <path
              d={line}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {data.map((item, index) => (
          <g key={item.key}>
            <circle cx={x(index)} cy={y(item.value)} r="3" fill="#2563eb" />

            {(data.length <= 10 ||
              index % labelInterval === 0 ||
              index === data.length - 1) && (
              <text
                x={x(index)}
                y={H - 9}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {item.label}
              </text>
            )}

            <title>{`${item.label}: ${money(item.value)}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ChangeIndicator({ value }) {
  if (value === null || value === undefined) {
    return <small className="pg-empty">No comparison data</small>;
  }

  const positive = value >= 0;
  const Icon = positive ? ArrowUp : ArrowDown;

  return (
    <small className={positive ? "up" : "down"}>
      <Icon size={12} />
      {Math.abs(value)}%<span> vs previous period</span>
    </small>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState("7d");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [partialError, setPartialError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [productTotal, setProductTotal] = useState(null);
  const [orderTotal, setOrderTotal] = useState(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setPartialError("");

    try {
      const results = await Promise.allSettled([
        fetchList(productsApi.list, "products"),
        fetchList(ordersApi.list, "orders"),
        fetchList(inventoryApi.list, "inventory"),
      ]);

      const [productResult, orderResult, inventoryResult] = results;

      const names = ["Products", "Orders", "Inventory"];

      const failures = results
        .map((result, index) => ({
          result,
          name: names[index],
        }))
        .filter(({ result }) => result.status === "rejected");

      if (failures.length === results.length) {
        const details = failures
          .map(({ name, result }) => {
            const reason = result.reason;

            return `${name}: ${reason?.message ?? String(reason)}`;
          })
          .join(" | ");

        throw new Error(`All dashboard requests failed. ${details}`);
      }

      if (productResult.status === "fulfilled") {
        setProducts(productResult.value.items);
        setProductTotal(productResult.value.total);
      }

      if (orderResult.status === "fulfilled") {
        setOrders(orderResult.value.items);
        setOrderTotal(orderResult.value.total);
      }

      if (inventoryResult.status === "fulfilled") {
        setInventory(inventoryResult.value.items);
      }

      const warnings = [];

      if (failures.length > 0) {
        warnings.push(
          `Failed requests: ${failures
            .map(
              ({ name, result }) =>
                `${name} (${result.reason?.message ?? "unknown error"})`,
            )
            .join("; ")}.`,
        );
      }

      const truncated = results.some(
        (result) => result.status === "fulfilled" && result.value.truncated,
      );

      if (truncated) {
        warnings.push(
          "Some lists are paginated. Sales and top-product analytics may only include the returned records.",
        );
      }

      setPartialError(warnings.join(" "));
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const days = range === "30d" ? 30 : 7;

  const activeProducts = useMemo(
    () => products.filter(isActiveProduct),
    [products],
  );

  const lowStockItems = useMemo(
    () =>
      inventory.filter((item) => {
        const stock = getInventoryStock(item);

        return stock !== null && stock <= getStockThreshold(item);
      }),
    [inventory],
  );

  const today = useMemo(() => startOfDay(new Date()), []);

  const { current: periodOrders, previous: previousPeriodOrders } = useMemo(
    () => getPeriod(orders, days, today),
    [orders, days, today],
  );

  const currentRevenue = useMemo(
    () => confirmedRevenue(periodOrders),
    [periodOrders],
  );

  const previousRevenue = useMemo(
    () => confirmedRevenue(previousPeriodOrders),
    [previousPeriodOrders],
  );

  const currentOrderCount = periodOrders.filter(
    (order) => !isCancelled(order),
  ).length;

  const previousOrderCount = previousPeriodOrders.filter(
    (order) => !isCancelled(order),
  ).length;

  const stats = useMemo(
    () => ({
      products: productTotal ?? activeProducts.length,
      orders: orderTotal ?? orders.length,
      revenue: currentRevenue,
      lowStock: lowStockItems.length,

      productsChange: null,

      ordersChange: percentChange(currentOrderCount, previousOrderCount),

      revenueChange: percentChange(currentRevenue, previousRevenue),

      lowStockChange: null,
    }),
    [
      productTotal,
      activeProducts.length,
      orderTotal,
      orders.length,
      currentRevenue,
      previousRevenue,
      currentOrderCount,
      previousOrderCount,
      lowStockItems.length,
    ],
  );

  const sales = useMemo(
    () => makeSalesSeries(periodOrders, days, today),
    [periodOrders, days, today],
  );

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => {
          const dateA = new Date(getOrderDate(a) ?? 0).getTime();

          const dateB = new Date(getOrderDate(b) ?? 0).getTime();

          return dateB - dateA;
        })
        .slice(0, 6)
        .map((order, index) => ({
          id: getId(order) ?? `order-${index}`,
          customer: getOrderCustomer(order),
          amount: getOrderTotal(order),
          status: getStatus(order),
          date: formatDate(getOrderDate(order)),
        })),
    [orders],
  );

  const topProducts = useMemo(() => {
    const productSales = new Map();

    for (const order of orders) {
      if (!isRevenueOrder(order)) continue;

      const items =
        order?.items ??
        order?.order_items ??
        order?.orderItems ??
        order?.products ??
        [];

      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const id =
          item?.product_id ?? item?.productId ?? item?.product?.id ?? item?.id;

        const name =
          item?.product_name ??
          item?.product?.name ??
          item?.name ??
          "Unnamed product";

        const quantity = firstNumber(
          item?.quantity,
          item?.qty,
          item?.ordered_quantity,
        );

        const price = firstNumber(
          item?.unit_price,
          item?.price,
          item?.selling_price,
        );

        const key = String(id ?? name);

        const existing = productSales.get(key) ?? {
          name,
          sales: 0,
          revenue: 0,
        };

        existing.sales += quantity;
        existing.revenue += quantity * price;

        productSales.set(key, existing);
      }
    }

    return [...productSales.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders]);

  const cards = [
    {
      label: "Total Products",
      value: stats.products,
      icon: Package,
      tone: "blue",
    },
    {
      label: "Total Orders",
      value: stats.orders,
      icon: ShoppingCart,
      tone: "blue",
    },
    {
      label: `Revenue · ${days} days`,
      value: stats.revenue,
      change: stats.revenueChange,
      icon: Banknote,
      tone: "green",
      currency: true,
    },
    {
      label: "Low Stock",
      value: stats.lowStock,
      icon: AlertTriangle,
      tone: "red",
    },
  ];

  return (
    <>
      <div className="sa-page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Overview of your store performance</p>

          {lastUpdated && (
            <small>Last updated: {lastUpdated.toLocaleTimeString()}</small>
          )}
        </div>

        <button
          type="button"
          className="sa-btn ghost"
          onClick={() => loadDashboard(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "sa-spin" : ""} />

          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="pdisp_message pdisp_message--error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
          >
            Retry
          </button>
        </div>
      )}

      {!error && partialError && (
        <div className="pdisp_message pdisp_message--error" role="status">
          {partialError}
        </div>
      )}

      <section className="sa-stats">
        {cards.map(({ label, value, change, icon: Icon, tone, currency }) => (
          <div className="sa-card sa-stat" key={label}>
            <div className="sa-stat-top">
              <span>{label}</span>

              <span className={`sa-stat-icon ${tone}`}>
                <Icon size={18} />
              </span>
            </div>

            <strong>
              {loading
                ? "…"
                : currency
                  ? money(value)
                  : Number(value ?? 0).toLocaleString("en-ET")}
            </strong>

            {!loading && change !== undefined && (
              <ChangeIndicator value={change} />
            )}
          </div>
        ))}
      </section>

      <section className="sa-grid">
        <div className="sa-card sa-span-2">
          <div className="sa-card-head">
            <div>
              <h3>Sales Overview</h3>
              <small>Confirmed revenue · Ethiopian birr</small>
            </div>

            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              aria-label="Sales period"
            >
              {RANGES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <SalesChart data={sales} loading={loading} />
        </div>

        <div className="sa-card">
          <div className="sa-card-head">
            <h3>Recent Orders</h3>

            <Link to="/admin/orders" className="sa-link-sm">
              View all
            </Link>
          </div>

          {loading ? (
            <p className="pg-empty">Loading orders…</p>
          ) : recentOrders.length === 0 ? (
            <p className="pg-empty">No orders found.</p>
          ) : (
            <ul className="sa-orders">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <span className="id">#{order.id}</span>

                  <span className="name">
                    {order.customer}
                    <small>{order.date}</small>
                  </span>

                  <span className="amt">{money(order.amount)}</span>

                  <span className={`sa-badge ${order.status}`}>
                    {order.status.replace(/-/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sa-card sa-span-2">
          <div className="sa-card-head">
            <h3>Top Products</h3>

            <Link to="/admin/products" className="sa-link-sm">
              View all
            </Link>
          </div>

          {loading ? (
            <p className="pg-empty">Loading products…</p>
          ) : topProducts.length === 0 ? (
            <p className="pg-empty">
              No product sales details are available in the returned orders.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>

                <tbody>
                  {topProducts.map((item) => (
                    <tr key={item.name}>
                      <td>
                        <span className="sa-thumb">
                          <Package size={18} />
                        </span>
                        {item.name}
                      </td>

                      <td>{item.sales.toLocaleString("en-ET")}</td>

                      <td>{money(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="sa-card">
          <div className="sa-card-head">
            <h3>Quick Actions</h3>
          </div>

          <div className="sa-actions">
            <Link to="/admin/products" className="sa-btn primary">
              <Plus size={16} />
              Manage Products
            </Link>

            <Link to="/admin/orders" className="sa-btn ghost">
              <ShoppingCart size={16} />
              View Orders
            </Link>

            <Link to="/admin/inventory" className="sa-btn ghost">
              <Package size={16} />
              Manage Inventory
            </Link>
          </div>
        </div>

        <div className="sa-card">
          <div className="sa-card-head">
            <h3>Inventory Alerts</h3>

            <Link to="/admin/inventory" className="sa-link-sm">
              Manage
            </Link>
          </div>

          {loading ? (
            <p className="pg-empty">Loading inventory…</p>
          ) : lowStockItems.length === 0 ? (
            <p className="pg-empty">
              No low-stock items in the returned inventory records.
            </p>
          ) : (
            <ul className="sa-orders">
              {lowStockItems.slice(0, 5).map((item, index) => (
                <li key={getId(item) ?? item?.sku ?? `inventory-${index}`}>
                  <span className="name">
                    {item?.product_name ??
                      item?.name ??
                      item?.sku ??
                      "Inventory item"}
                  </span>

                  <span className="amt">{getInventoryStock(item)} left</span>

                  <span className="sa-badge pending">Low stock</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
