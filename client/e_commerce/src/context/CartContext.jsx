import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
// Legacy fallback only: guest lines saved before the API existed. Once every page
// loads products from the API (and old guest carts are gone) you can delete both imports.
import { categories as products } from "../component/Assets/product.js";
import { getStock } from "../component/Assets/stock.js";
import {
  DELIVERY_ZONES,
  DEFAULT_ZONE,
  FREE_DELIVERY_OVER,
} from "../page/DeliveryConfog.js";
import {
  getCart,
  addItem as apiAddItem,
  updateItem as apiUpdateItem,
  removeItem as apiRemoveItem,
  clearCart as apiClearCart,
} from "../lib/cartApi.js";

const CartContext = createContext(null);

const STORAGE_KEY = "cart_v1";
const ZONE_KEY = "cart_zone_v1";
const MAX_QTY = 10;

const limitFor = (stock) => Math.min(MAX_QTY, stock);

// Stock is counted per variant (each size has its own stock).
// Old lines without a variant fall back to counting per product.
const stockKey = (i) => (i.variantId ? `v${i.variantId}` : `p${i.id}`);
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

const hasToken = () => {
  try {
    return !!localStorage.getItem("token");
  } catch {
    return false;
  }
};

const loadGuest = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadZone = () => {
  try {
    const saved = localStorage.getItem(ZONE_KEY);
    return DELIVERY_ZONES.some((z) => z.id === saved) ? saved : DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
};

// ---- server item -> frontend shape ----
// Every text field has a safe default, so pages never call .replace() etc. on undefined.
const fromServer = (it) => {
  const productId = it.productId ?? it.product_id ?? null;
  // cart item id (used for update/remove and as the React key)
  const itemId = it.id ?? it.cart_item_id ?? it.cartItemId ?? it.item_id;
  if (itemId == null) {
    console.warn(
      "Cart item has no id field. Fields received:",
      Object.keys(it),
    );
  }
  return {
    key: itemId,
    id: productId,
    variantId:
      it.product_variant_id ?? it.productVariantId ?? it.variantId ?? null,
    size: it.size || "",
    qty: Number(it.quantity ?? it.qty) || 0,
    stock: Number(it.stock ?? it.stock_quantity) || 0,
    product: {
      id: productId,
      name: it.name ?? it.product_name ?? "",
      image: it.image ?? it.image_url ?? "",
      category: it.category ?? "",
      new_price: Number(it.price ?? it.unit_price) || 0,
    },
  };
};

// ---- guest item -> frontend shape ----
// New guest lines carry their own product snapshot and stock.
const fromGuest = (i) => {
  const product = i.product ?? products.find((p) => p.id === i.id);
  if (!product) return null;
  return {
    key: i.key,
    id: i.id,
    variantId: i.variantId || null,
    size: i.size || "",
    qty: i.qty,
    stock: Number.isFinite(i.stock) ? i.stock : getStock(i.id),
    product: { category: "", image: "", name: "", ...product },
  };
};

export const CartProvider = ({ children }) => {
  const [loggedIn, setLoggedIn] = useState(hasToken);
  const loggedInRef = useRef(loggedIn);

  const [guestItems, setGuestItems] = useState(loadGuest);
  const guestRef = useRef(guestItems);
  const commitGuest = useCallback((next) => {
    guestRef.current = next;
    setGuestItems(next);
  }, []);

  const [serverItems, setServerItems] = useState([]);
  const serverRef = useRef([]);
  const commitServer = useCallback((next) => {
    serverRef.current = next;
    setServerItems(next);
  }, []);

  const [zoneId, setZoneId] = useState(loadZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ---- persistence ----
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestItems));
    } catch {
      /* ignore */
    }
  }, [guestItems]);

  useEffect(() => {
    try {
      localStorage.setItem(ZONE_KEY, zoneId);
    } catch {
      /* ignore */
    }
  }, [zoneId]);

  // ---- load server cart ----
  const refresh = useCallback(async () => {
    if (!hasToken()) {
      commitServer([]);
      return;
    }
    try {
      const data = await getCart();
      // accept { items: [...] }, { cart: { items: [...] } } or a plain array
      const items = Array.isArray(data)
        ? data
        : (data?.items ?? data?.cart?.items ?? []);
      commitServer(items.map(fromServer));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [commitServer]);

  // ---- login / logout ----
  useEffect(() => {
    async function onLogin() {
      loggedInRef.current = true;
      setLoggedIn(true);

      // merge guest cart (only lines that already have a variantId can be sent)
      for (const g of guestRef.current) {
        if (!g.variantId) continue;
        try {
          await apiAddItem(g.variantId, g.qty);
        } catch {
          /* skip items the server refuses */
        }
      }
      commitGuest([]);
      await refresh();
    }

    function onLogout() {
      loggedInRef.current = false;
      setLoggedIn(false);
      commitServer([]);
      setError("");
    }

    if (hasToken()) refresh();

    window.addEventListener("auth:login", onLogin);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:login", onLogin);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, [refresh, commitGuest, commitServer]);

  // ---- helpers ----
  const runServer = useCallback(
    async (action) => {
      setBusy(true);
      setError("");
      try {
        await action();
        await refresh();
        return { ok: true };
      } catch (e) {
        setError(e.message);
        return { ok: false, reason: "error", message: e.message };
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  // ---- actions ----
  // stock   = stock of the chosen variant (from the API); optional
  // product = small snapshot { id, name, image, category, new_price, old_price }
  //           saved on guest lines so the cart does not need product.js
  const addItem = useCallback(
    async ({
      id,
      size = "",
      qty = 1,
      variantId = null,
      stock = null,
      product = null,
    }) => {
      const knownStock = Number.isFinite(stock) ? stock : null;

      // ---------- GUEST MODE ----------
      if (!loggedInRef.current) {
        const current = guestRef.current;
        const stockNow = knownStock ?? getStock(id);
        const max = limitFor(stockNow);

        if (stockNow <= 0) {
          return { ok: false, added: 0, max: 0, reason: "soldout" };
        }

        const key = variantId ? `v${variantId}` : `${id}-${size}`;
        const sk = variantId ? `v${variantId}` : `p${id}`;

        const inCart = current
          .filter((i) => stockKey(i) === sk)
          .reduce((n, i) => n + i.qty, 0);

        const room = max - inCart;
        if (room <= 0) {
          return { ok: false, added: 0, max, reason: "limit" };
        }

        const add = Math.min(qty, room);
        const found = current.find((i) => i.key === key);

        const snapshot = product
          ? {
              id,
              name: product.name ?? "",
              image: product.image ?? "",
              category: product.category ?? "",
              new_price: Number(product.new_price) || 0,
              old_price: Number(product.old_price) || 0,
            }
          : undefined;

        commitGuest(
          found
            ? current.map((i) =>
                i.key === key ? { ...i, qty: i.qty + add, stock: stockNow } : i,
              )
            : [
                ...current,
                {
                  key,
                  id,
                  size,
                  qty: add,
                  variantId,
                  stock: stockNow,
                  product: snapshot,
                },
              ],
        );

        return { ok: true, added: add, capped: add < qty, max };
      }

      // ---------- SERVER MODE ----------
      if (!variantId) {
        return {
          ok: false,
          reason: "error",
          message: "product_variant_id is required",
        };
      }

      let add = qty;
      let max = MAX_QTY;

      if (knownStock !== null) {
        if (knownStock <= 0) {
          return { ok: false, added: 0, max: 0, reason: "soldout" };
        }
        max = limitFor(knownStock);
        const existing = serverRef.current
          .filter((l) => sameId(l.variantId, variantId))
          .reduce((n, l) => n + l.qty, 0);
        const room = max - existing;
        if (room <= 0) {
          return { ok: false, added: 0, max, reason: "limit" };
        }
        add = Math.min(qty, room);
      }

      const result = await runServer(() => apiAddItem(variantId, add));
      if (!result.ok) return result;
      return { ok: true, added: add, capped: add < qty, max };
    },
    [commitGuest, runServer],
  );

  const setQty = useCallback(
    async (key, qty) => {
      if (!loggedInRef.current) {
        const current = guestRef.current;
        const line = current.find((i) => i.key === key);
        if (!line) return;

        const sk = stockKey(line);
        const others = current
          .filter((i) => stockKey(i) === sk && i.key !== key)
          .reduce((n, i) => n + i.qty, 0);

        const lineStock = Number.isFinite(line.stock)
          ? line.stock
          : getStock(line.id);
        const room = Math.max(1, limitFor(lineStock) - others);
        const safe = Math.min(room, Math.max(1, qty));

        commitGuest(
          current.map((i) => (i.key === key ? { ...i, qty: safe } : i)),
        );
        return { ok: true };
      }

      const current = serverRef.current;
      const line = current.find((i) => i.key === key);
      if (!line) return;

      const sk = stockKey(line);
      const others = current
        .filter((i) => stockKey(i) === sk && i.key !== key)
        .reduce((n, i) => n + i.qty, 0);

      const room = Math.max(1, limitFor(line.stock) - others);
      const safe = Math.min(room, Math.max(1, qty));

      return runServer(() => apiUpdateItem(key, safe));
    },
    [commitGuest, runServer],
  );

  const removeItem = useCallback(
    async (key) => {
      if (!loggedInRef.current) {
        commitGuest(guestRef.current.filter((i) => i.key !== key));
        return { ok: true };
      }
      return runServer(() => apiRemoveItem(key));
    },
    [commitGuest, runServer],
  );

  const clear = useCallback(async () => {
    if (!loggedInRef.current) {
      commitGuest([]);
      return { ok: true };
    }
    return runServer(() => apiClearCart());
  }, [commitGuest, runServer]);

  // ---- derived state ----
  const lines = useMemo(() => {
    const base = loggedIn
      ? serverItems
      : guestItems.map(fromGuest).filter(Boolean);

    const totals = {};
    base.forEach((i) => {
      const k = stockKey(i);
      totals[k] = (totals[k] || 0) + i.qty;
    });

    return base.map((i) => {
      const others = totals[stockKey(i)] - i.qty;
      return {
        ...i,
        product: { ...i.product, stock: i.stock },
        max: Math.max(0, limitFor(i.stock) - others),
        lineTotal: (i.product.new_price || 0) * i.qty,
      };
    });
  }, [loggedIn, serverItems, guestItems]);

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const stockProblem = lines.some((l) => l.stock <= 0 || l.qty > l.max);

  const zone = DELIVERY_ZONES.find((z) => z.id === zoneId) || DELIVERY_ZONES[0];
  const freeDelivery =
    FREE_DELIVERY_OVER != null && subtotal >= FREE_DELIVERY_OVER;
  const deliveryFee = lines.length === 0 ? 0 : freeDelivery ? 0 : zone.fee;
  const amountToFree =
    FREE_DELIVERY_OVER != null && !freeDelivery && lines.length > 0
      ? FREE_DELIVERY_OVER - subtotal
      : 0;
  const total = subtotal + deliveryFee;

  const value = useMemo(
    () => ({
      lines,
      count,
      subtotal,
      deliveryFee,
      freeDelivery,
      amountToFree,
      total,
      stockProblem,
      zones: DELIVERY_ZONES,
      zoneId,
      setZoneId,
      addItem,
      setQty,
      removeItem,
      clear,
      refresh,
      busy,
      error,
      loggedIn,
      MAX_QTY,
    }),
    [
      lines,
      count,
      subtotal,
      deliveryFee,
      freeDelivery,
      amountToFree,
      total,
      stockProblem,
      zoneId,
      addItem,
      setQty,
      removeItem,
      clear,
      refresh,
      busy,
      error,
      loggedIn,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return ctx;
};
