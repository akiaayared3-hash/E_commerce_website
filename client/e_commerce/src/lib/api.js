const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  let body = options.body;

  if (body && !isFormData && typeof body === "object") {
    body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}/${String(path).replace(/^\/+/, "")}`;

  let response;

  try {
    response = await fetch(url, {
      ...options,
      body,
      headers: {
        ...(isFormData || body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the server");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event("auth:logout"));
    }

    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}
