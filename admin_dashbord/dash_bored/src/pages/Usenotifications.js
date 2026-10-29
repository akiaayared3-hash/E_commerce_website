import { useCallback, useEffect, useRef, useState } from "react";

// Adjust these to match your backend.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const POLL_INTERVAL_MS = 20000;
const getToken = () => localStorage.getItem("token");

async function request(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // empty or non-JSON body
  }

  if (!response.ok) {
    throw new Error(body?.message || `Request failed (${response.status})`);
  }

  return body;
}

// Accepts [], { notifications: [] }, { data: [] }, { rows: [] }, { data: { notifications: [] } }
export function extractList(body) {
  if (Array.isArray(body)) return body;
  const candidates = [
    body?.notifications,
    body?.data,
    body?.rows,
    body?.data?.notifications,
    body?.data?.rows,
  ];
  return candidates.find(Array.isArray) ?? [];
}

export default function useNotifications({ enabled = true } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const abortRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setLoading(true);

    try {
      const body = await request("/notifications?limit=50", {
        signal: controller.signal,
      });
      setNotifications(extractList(body));
      setFetchError("");
    } catch (err) {
      if (err.name === "AbortError") return;
      setFetchError(err.message || "Could not load notifications.");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  // Initial load + polling (paused while the tab is hidden).
  useEffect(() => {
    if (!enabled) return undefined;

    load();

    const tick = () => {
      if (!document.hidden) load({ silent: true });
    };
    const onVisible = () => {
      if (!document.hidden) load({ silent: true });
    };

    const timer = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      abortRef.current?.abort();
    };
  }, [enabled, load]);

  // Handlers THROW on failure so the dropdown can show the error.
  const markRead = useCallback(
    async (id) => {
      const previous = notifications;
      setNotifications((list) =>
        list.map((n) =>
          (n.id ?? n.notification_id) === id
            ? { ...n, is_read: true, read: true }
            : n,
        ),
      );
      try {
        await request(`/notifications/${id}/read`, { method: "PATCH" });
      } catch (err) {
        setNotifications(previous);
        throw err;
      }
    },
    [notifications],
  );

  const markAllRead = useCallback(async () => {
    const previous = notifications;
    setNotifications((list) =>
      list.map((n) => ({ ...n, is_read: true, read: true })),
    );
    try {
      await request("/notifications/read-all", { method: "PATCH" });
    } catch (err) {
      setNotifications(previous);
      throw err;
    }
  }, [notifications]);

  const clearAll = useCallback(async () => {
    await request("/notifications", { method: "DELETE" });
    setNotifications([]);
  }, []);

  return {
    notifications,
    loading,
    fetchError,
    refresh: load,
    markRead,
    markAllRead,
    clearAll,
  };
}
