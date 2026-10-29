// src/lib/api.js
const BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, ""); // ADJUST port or set VITE_API_URL in .env (restart Vite after changing it)
const TOKEN_KEY = "token"; // must match AuthContext

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// AuthContext registers a callback here. It runs when a request that carried
// a token comes back 401 (expired or invalid session).
let onUnauthorized = null;
export const setOnUnauthorized = (fn) => {
  onUnauthorized = typeof fn === "function" ? fn : null;
};

// Turns a relative upload path (/uploads/x.jpg) into a full URL for <img src>
export const assetUrl = (u) =>
  !u ? "" : /^(https?:|data:|blob:)/.test(u) ? u : `${BASE_URL}${u}`;

// Adds ?page=1&limit=10 style params, skipping empty values
export const withQuery = (path, params = {}) => {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  const qs = new URLSearchParams(entries).toString();
  return qs ? `${path}?${qs}` : path;
};

export async function apiRequest(
  path,
  { method = "GET", body, headers = {}, signal } = {},
) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders = { Accept: "application/json", ...headers };
  const token = readToken();
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  // For FormData the browser sets Content-Type (with the boundary) itself
  if (body !== undefined && !isForm)
    finalHeaders["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      // No "credentials" option: the token travels in the Authorization header,
      // so cookies (and the extra CORS rules they need) are not required.
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Cannot reach the server. Check your connection.", 0);
  }

  // 204 or empty body
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    // Expired or invalid session: only when we sent a token, and never for the
    // login request itself (a wrong password is also a 401).
    if (res.status === 401 && token && !path.includes("/auth/login")) {
      onUnauthorized?.();
    }
    const message =
      data?.message || data?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data;
}
