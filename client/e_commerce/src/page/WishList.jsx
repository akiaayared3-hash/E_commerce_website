import React, { createContext, useContext, useEffect, useState } from "react";

const KEY = "wishlist_ids";
const WishlistContext = createContext(null);

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Number.isFinite) : [];
  } catch {
    return [];
  }
};

export const WishList = ({ children }) => {
  const [ids, setIds] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* storage can be blocked, the list still works for this visit */
    }
  }, [ids]);

  const has = (id) => ids.includes(id);
  const toggle = (id) =>
    setIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  const clear = () => setIds([]);

  return (
    <WishlistContext.Provider
      value={{ ids, has, toggle, clear, count: ids.length }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishList = () => {
  const ctx = useContext(WishlistContext); // fixed
  if (!ctx) throw new Error("useWishList must be used inside <WishList>");
  return ctx;
};
