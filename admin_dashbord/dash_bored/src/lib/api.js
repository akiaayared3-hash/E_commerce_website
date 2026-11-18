// src/lib/api.js

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const TOKEN_KEY = "token";

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

let onUnauthorized = null;

export const setOnUnauthorized = (fn) => {
  onUnauthorized = typeof fn === "function" ? fn : null;
};

export const assetUrl = (u) =>
  !u
    ? ""
    : /^(https?:|data:|blob:)/.test(u)
      ? u
      : `${API_BASE_URL}/${String(u).replace(/^\/+/, "")}`;

export const withQuery = (path, params = {}) => {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );

  const qs = new URLSearchParams(entries).toString();

  return qs ? `${path}?${qs}` : path;
};

export async function apiRequest(
  path,
  { method = "GET", body, headers = {}, signal } = {},
) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders = {
    Accept: "application/json",
    ...headers,
  };

  const token = readToken();

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && !isForm) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const url = `${API_BASE_URL}/${String(path).replace(/^\/+/, "")}`;

  let res;

  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;

    throw new ApiError("Cannot reach the server. Check your connection.", 0);
  }

  const responseText = await res.text();

  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token && !path.includes("/auth/login")) {
      onUnauthorized?.();
    }

    const message =
      data?.message || data?.error || `Request failed (${res.status})`;

    throw new ApiError(message, res.status, data);
  }

  return data;
}
