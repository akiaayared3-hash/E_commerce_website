import { apiRequest } from "./api.js";

const BASE = "/api/category";

const unwrap = (response) => response?.data ?? response;

export async function list() {
  const response = await apiRequest(BASE);
  const result = unwrap(response);

  // Support either { categories: [...] } or a direct array.
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.categories)) return result.categories;

  throw new Error("The server returned an invalid categories response.");
}

export async function getOne(id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error("Category ID must be a positive whole number.");
  }

  const response = await apiRequest(
    `${BASE}/${encodeURIComponent(String(id))}`,
  );

  return unwrap(response);
}

export async function create(name) {
  const normalizedName = String(name ?? "").trim();

  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  const response = await apiRequest(BASE, {
    method: "POST",
    body: { name: normalizedName },
  });

  return unwrap(response);
}

export async function update(id, name) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error("Category ID must be a positive whole number.");
  }

  const normalizedName = String(name ?? "").trim();

  if (!normalizedName) {
    throw new Error("Category name is required.");
  }

  const response = await apiRequest(
    `${BASE}/${encodeURIComponent(String(id))}`,
    {
      method: "PATCH",
      body: { name: normalizedName },
    },
  );

  return unwrap(response);
}

export async function remove(id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error("Category ID must be a positive whole number.");
  }

  await apiRequest(`${BASE}/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}
