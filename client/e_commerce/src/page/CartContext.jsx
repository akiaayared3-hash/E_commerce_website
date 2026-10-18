import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { categories as products } from "../component/Assets/product.js";
import { getStock } from "../component/Assets/stock.js";
import {
  DELIVERY_ZONES,
  DEFAULT_ZONE,
  FREE_DELIVERY_OVER,
} from "./DeliveryConfog.js";

const CartContext = createContext(null);

const STORAGE_KEY = "cart_v1";
const ZONE_KEY = "cart_zone_v1";
const MAX_QTY = 10; // most of one product per order (also limited by real stock)

// most of a product a customer may have in the cart: the smaller of the cap and the stock
const limitFor = (id) => Math.min(MAX_QTY, getStock(id));

// the cart survives page refreshes (kept in the browser's localStorage)
const load = () => {
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

export const CartProvider = ({ children }) => {
  // each item: { key, id, size, qty }  (only ids are stored, prices always come
  // from product.js so they can never be out of date)
  const [items, setItems] = useState(load);
  const [zoneId, setZoneId] = useState(loadZone);

  // always holds the newest items, so two quick clicks can't slip past the limit
  const itemsRef = useRef(items);
  const commit = (next) => {
    itemsRef.current = next;
    setItems(next);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or blocked: cart still works for this visit */
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(ZONE_KEY, zoneId);
    } catch {
      /* ignore */
    }
  }, [zoneId]);

  // Adds to the cart but never above the limit for that product (all sizes together).
  // Returns { ok, added, capped, max, reason } so the page can tell the customer why.
  const addItem = useCallback(({ id, size = "", qty = 1 }) => {
    const current = itemsRef.current;
    const stock = getStock(id);
    const max = limitFor(id);

    if (stock <= 0) return { ok: false, added: 0, max: 0, reason: "soldout" };

    const inCart = current
      .filter((i) => i.id === id)
      .reduce((n, i) => n + i.qty, 0);
    const room = max - inCart;
    if (room <= 0) return { ok: false, added: 0, max, reason: "limit" };

    const add = Math.min(qty, room);
    const key = `${id}-${size}`;
    const found = current.find((i) => i.key === key);
    const next = found
      ? current.map((i) => (i.key === key ? { ...i, qty: i.qty + add } : i))
      : [...current, { key, id, size, qty: add }];
    commit(next);
    return { ok: true, added: add, capped: add < qty, max };
  }, []);

  // Changes one line's quantity, never above what is left for that product.
  const setQty = useCallback((key, qty) => {
    const current = itemsRef.current;
    const line = current.find((i) => i.key === key);
    if (!line) return;
    const others = current
      .filter((i) => i.id === line.id && i.key !== key)
      .reduce((n, i) => n + i.qty, 0);
    const room = Math.max(1, limitFor(line.id) - others);
    const safe = Math.min(room, Math.max(1, qty));
    commit(current.map((i) => (i.key === key ? { ...i, qty: safe } : i)));
  }, []);

  const removeItem = useCallback((key) => {
    commit(itemsRef.current.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => commit([]), []);

  // lines = items joined with their product data
  const lines = useMemo(() => {
    const totals = {};
    items.forEach((i) => {
      totals[i.id] = (totals[i.id] || 0) + i.qty;
    });
    return items
      .map((i) => {
        const product = products.find((p) => p.id === i.id);
        if (!product) return null; // product was removed from product.js
        const stock = getStock(i.id);
        const others = totals[i.id] - i.qty;
        return {
          ...i,
          product: { ...product, stock },
          stock,
          // the most this line may hold right now
          max: Math.max(0, limitFor(i.id) - others),
          lineTotal: (product.new_price || 0) * i.qty,
        };
      })
      .filter(Boolean);
  }, [items]);

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // true if anything in the cart is sold out or above stock (blocks checkout)
  const stockProblem = lines.some((l) => l.stock <= 0 || l.qty > l.max);

  // ---- delivery ----
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
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
};
