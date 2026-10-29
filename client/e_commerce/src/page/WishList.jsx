
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "wishlist_ids";

const WishlistContext = createContext(null);

/**
 * Normalize IDs consistently across API responses and UI components.
 * Numeric IDs become numbers; non-empty string IDs remain strings.
 */
function normalizeId(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return null;

    if (/^[1-9]\d*$/.test(trimmed)) {
      const numericId = Number(trimmed);

      if (Number.isSafeInteger(numericId)) {
        return numericId;
      }
    }

    return trimmed;
  }

  return null;
}

function normalizeIds(values) {
  if (!Array.isArray(values)) return [];

  const unique = new Set();

  for (const value of values) {
    const id = normalizeId(value);

    if (id !== null) unique.add(id);
  }

  return [...unique];
}

function loadWishlist() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    return normalizeIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export const WishList = ({ children }) => {
  const [ids, setIds] = useState(loadWishlist);

  // Persist changes. Storage may be unavailable in private or restricted
  // browsing contexts, so storage failures must not break the UI.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Wishlist continues to work in memory for the current visit.
    }
  }, [ids]);

  // Synchronize changes made in other tabs.
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;

      if (event.key === null) {
        setIds([]);
        return;
      }

      try {
        setIds(normalizeIds(JSON.parse(event.newValue || "[]")));
      } catch {
        // Ignore malformed data written by another tab.
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const has = useCallback((id) => {
    const normalized = normalizeId(id);

    return normalized !== null && ids.includes(normalized);
  }, [ids]);

  const toggle = useCallback((id) => {
    const normalized = normalizeId(id);

    if (normalized === null) return;

    setIds((current) =>
      current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : [...current, normalized],
    );
  }, []);

  const add = useCallback((id) => {
    const normalized = normalizeId(id);

    if (normalized === null) return;

    setIds((current) =>
      current.includes(normalized)
        ? current
        : [...current, normalized],
    );
  }, []);

  const remove = useCallback((id) => {
    const normalized = normalizeId(id);

    if (normalized === null) return;

    setIds((current) =>
      current.filter((item) => item !== normalized),
    );
  }, []);

  const clear = useCallback(() => {
    setIds([]);
  }, []);

  const value = useMemo(() => ({
    ids,
    has,
    toggle,
    add,
    remove,
    clear,
    count: ids.length,
  }), [ids, has, toggle, add, remove, clear]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishList = () => {
  const context = useContext(WishlistContext);

  if (context === null) {
    throw new Error("useWishList must be used inside <WishList>");
  }

  return context;
};

