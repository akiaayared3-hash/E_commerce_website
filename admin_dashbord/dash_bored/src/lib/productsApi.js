import { apiRequest, withQuery } from "../lib/api.js";

const ENDPOINT = "/api/products";
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const validatePagination = ({ page, limit }) => {
  const normalizedPage = Number(page ?? DEFAULT_PAGE);
  const normalizedLimit = Number(limit ?? DEFAULT_LIMIT);

  if (!Number.isSafeInteger(normalizedPage) || normalizedPage < 1) {
    throw new Error("Page must be a positive integer.");
  }

  if (
    !Number.isSafeInteger(normalizedLimit) ||
    normalizedLimit < 1 ||
    normalizedLimit > MAX_LIMIT
  ) {
    throw new Error(`Limit must be between 1 and ${MAX_LIMIT}.`);
  }

  return { page: normalizedPage, limit: normalizedLimit };
};

const buildQuery = (options = {}) => {
  const { page, limit } = validatePagination(options);
  const query = { page, limit };

  if (options.search?.trim()) {
    query.search = options.search.trim();
  }

  if (options.category_id != null && options.category_id !== "") {
    query.category_id = options.category_id;
  }

  if (options.is_active != null) {
    query.is_active = options.is_active;
  }

  if (options.sort) {
    query.sort = options.sort;
  }

  return query;
};

export const productsApi = {
  /**
   * Retrieve a paginated product list.
   * Returns the original response from the API helper.
   */
  list(options = {}) {
    return apiRequest(withQuery(ENDPOINT, buildQuery(options)));
  },

  /**
   * Retrieve one product by its ID.
   */
  getById(id) {
    if (id == null || String(id).trim() === "") {
      throw new Error("A product ID is required.");
    }

    return apiRequest(`${ENDPOINT}/${encodeURIComponent(String(id))}`);
  },

  /**
   * Retrieve a product by its slug.
   */
  getBySlug(slug) {
    if (typeof slug !== "string" || !slug.trim()) {
      throw new Error("A product slug is required.");
    }

    return apiRequest(`${ENDPOINT}/slug/${encodeURIComponent(slug.trim())}`);
  },
};

export default productsApi;
