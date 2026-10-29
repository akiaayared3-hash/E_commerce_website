import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiRequest } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

export const MAX_QTY = 10;
const STORAGE_KEY = "cart_v1";

// ADJUST: delivery zones, fees (ETB) and the free-delivery threshold
const ZONES = [
  { id: "debre-birhan", label: "Debre Birhan", fee: 100 },
  { id: "addis-ababa", label: "Addis Ababa", fee: 150 },
  { id: "other", label: "Other cities", fee: 250 },
];
const FREE_DELIVERY_FROM = 5000;

// ADJUST: your real cart endpoints
const CART_API = {
  clear: "/api/cart", // DELETE: empties the user's cart
  add: "/api/cart/items", // POST { product_variant_id, quantity }
};

const CartContext = createContext(null);

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const save = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage blocked: cart still works in memory */
  }
};

const keyOf = (id, variantId, size) => `${variantId ?? id}-${size || ""}`;

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState(load);
  const [zoneId, setZoneId] = useState(ZONES[0].id);
  const dirty = useRef(false); // true only after the shopper changed the cart
  const syncChain = useRef(Promise.resolve());

  useEffect(() => save(items), [items]);

  // ---- server mirror: replace the server cart with the local one ----
  const syncCart = useCallback(async () => {
    if (!user) return false;

    const snapshot = items.filter((i) => i.variantId);
    syncChain.current = syncChain.current.then(async () => {
      await apiRequest(CART_API.clear, { method: "DELETE" });
      for (const i of snapshot) {
        await apiRequest(CART_API.add, {
          method: "POST",
          body: { product_variant_id: i.variantId, quantity: i.qty },
        });
      }
      dirty.current = false;
    });

    await syncChain.current;
    return true;
  }, [user, items]);

  // debounce: sync shortly after the last change
  useEffect(() => {
    if (!user || !dirty.current) return;
    const t = setTimeout(() => {
      syncCart().catch((err) => console.error("Cart sync failed:", err));
    }, 600);
    return () => clearTimeout(t);
  }, [items, user, syncCart]);

  // when a guest logs in with items in the cart, push them to the server
  useEffect(() => {
    if (user && items.length) dirty.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---- actions ----
  const addItem = useCallback(
    async ({
      id,
      size = "",
      qty = 1,
      variantId = null,
      stock = null,
      product,
    }) => {
      if (stock !== null && stock <= 0) return { ok: false, reason: "soldout" };

      const key = keyOf(id, variantId, size);
      const cap = Math.min(MAX_QTY, stock ?? MAX_QTY);

      // total of this variant already in the cart (across sizes of the same variant)
      const existing = items.find((i) => i.key === key);
      const have = existing?.qty ?? 0;
      const room = cap - have;

      if (room <= 0) return { ok: false, reason: "limit", max: cap };

      const added = Math.min(Math.max(1, qty), room);

      dirty.current = true;
      setItems((prev) => {
        const found = prev.find((i) => i.key === key);
        if (found) {
          return prev.map((i) =>
            i.key === key ? { ...i, qty: i.qty + added, stock } : i,
          );
        }
        return [
          ...prev,
          { key, id, variantId, size, qty: added, stock, product },
        ];
      });

      return { ok: true, added, capped: added < qty, max: cap };
    },
    [items],
  );

  const setQty = useCallback((key, qty) => {
    dirty.current = true;
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          const cap = Math.min(MAX_QTY, i.stock ?? MAX_QTY);
          return { ...i, qty: Math.min(Math.max(0, qty), cap) };
        })
        .filter((i) => i.qty > 0),
    );
  }, []);

  const removeItem = useCallback((key) => {
    dirty.current = true;
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => {
    dirty.current = false; // the server clears the cart itself after an order
    setItems([]);
  }, []);

  // ---- derived values ----
  const lines = useMemo(
    () =>
      items.map((i) => {
        const unit = Number(i.product?.new_price) || 0;
        return { ...i, unitPrice: unit, lineTotal: unit * i.qty };
      }),
    [items],
  );

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines]);
  const subtotal = useMemo(
    () => lines.reduce((n, l) => n + l.lineTotal, 0),
    [lines],
  );

  const zone = ZONES.find((z) => z.id === zoneId) || ZONES[0];
  const freeDelivery = subtotal >= FREE_DELIVERY_FROM;
  const deliveryFee = lines.length === 0 || freeDelivery ? 0 : zone.fee;
  const total = subtotal + deliveryFee;

  // true when any line wants more than the stock we last saw
  const stockProblem = useMemo(
    () =>
      lines.some(
        (l) => l.stock !== null && l.stock !== undefined && l.qty > l.stock,
      ),
    [lines],
  );

  const value = useMemo(
    () => ({
      lines,
      count,
      subtotal,
      deliveryFee,
      freeDelivery,
      total,
      zones: ZONES,
      zoneId,
      setZoneId,
      stockProblem,
      MAX_QTY,
      addItem,
      setQty,
      removeItem,
      clear,
      syncCart,
    }),
    [
      lines,
      count,
      subtotal,
      deliveryFee,
      freeDelivery,
      total,
      zoneId,
      stockProblem,
      addItem,
      setQty,
      removeItem,
      clear,
      syncCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
};
