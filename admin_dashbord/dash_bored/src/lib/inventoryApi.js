import { apiRequest, withQuery } from "../lib/api.js";

const ENDPOINT = "/api/inventory";
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

  if (options.product_variant_id != null) {
    query.product_variant_id = options.product_variant_id;
  }

  if (options.low_stock != null) {
    query.low_stock = options.low_stock;
  }

  return query;
};

const validateId = (id) => {
  if (id == null || !/^[1-9]\d*$/.test(String(id))) {
    throw new Error("A valid inventory ID is required.");
  }

  return encodeURIComponent(String(id));
};

export const inventoryApi = {
  /**
   * Retrieve inventory records.
   */
  list(options = {}) {
    return apiRequest(withQuery(ENDPOINT, buildQuery(options)));
  },

  /**
   * Retrieve one inventory record.
   * Confirm that this route exists in your inventory router.
   */
  getById(id) {
    return apiRequest(`${ENDPOINT}/${validateId(id)}`);
  },
};

export default inventoryApi;
