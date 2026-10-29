const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;

  // turn plain objects into JSON text automatically
  let body = options.body;
  if (body && !isFormData && typeof body === "object") {
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      body,
      headers: {
        // for FormData the browser must set the content type itself
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the server");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // token existed but the server says it is no longer valid
    if (response.status === 401 && token) {
      window.dispatchEvent(new Event("auth:logout"));
    }
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}
