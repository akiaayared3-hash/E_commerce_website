import { apiRequest, withQuery } from "../lib/api.js";

const ENDPOINT = "/api/orders";
const ADMIN = `${ENDPOINT}/admin`;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ALLOWED_STATUSES = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------ */

const validatePagination = ({ page, limit } = {}) => {
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

const validateId = (id) => {
  if (id == null || !/^[1-9]\d*$/.test(String(id))) {
    throw new Error("A valid order ID is required.");
  }
  return encodeURIComponent(String(id));
};

const normalizeStatus = (status) => {
  if (typeof status !== "string" || !status.trim()) {
    throw new Error("An order status is required.");
  }

  const value = status.trim().toLowerCase();

  if (!ALLOWED_STATUSES.has(value)) {
    throw new Error(`Unsupported order status: "${status}".`);
  }

  return value;
};

/**
 * Build list query for admin or public list endpoints.
 * Only includes defined, non-empty filters.
 */
const buildListQuery = (options = {}) => {
  const { page, limit } = validatePagination(options);
  const query = { page, limit };

  if (options.search?.trim()) {
    query.search = options.search.trim().slice(0, 100);
  }

  if (options.status?.trim()) {
    const status = options.status.trim().toLowerCase();
    if (status !== "all") {
      query.status = status;
    }
  }

  if (options.start_date) query.start_date = options.start_date;
  if (options.end_date) query.end_date = options.end_date;

  return query;
};

/**
 * Body for status updates used by the admin UI.
 * expectedStatus enables optimistic concurrency (409 on mismatch).
 */
const buildStatusBody = ({
  status,
  expectedStatus,
  trackingNumber,
  reason,
  note,
} = {}) => {
  const body = {
    status: normalizeStatus(status),
  };

  if (expectedStatus != null && String(expectedStatus).trim()) {
    body.expectedStatus = String(expectedStatus).trim().toLowerCase();
  }

  if (trackingNumber != null && String(trackingNumber).trim()) {
    const value = String(trackingNumber).trim();
    if (value.length < 3) {
      throw new Error("Tracking number must be at least 3 characters.");
    }
    if (value.length > 100) {
      throw new Error("Tracking number is too long.");
    }
    body.trackingNumber = value;
  }

  if (reason != null && String(reason).trim()) {
    const value = String(reason).trim();
    if (value.length > 500) {
      throw new Error("Cancellation reason is too long.");
    }
    body.reason = value;
  }

  if (note != null && String(note).trim()) {
    const value = String(note).trim();
    if (value.length > 500) {
      throw new Error("Internal note is too long.");
    }
    body.note = value;
  }

  return body;
};

/* ------------------------------------------------------------------
   Public API
------------------------------------------------------------------ */

export const ordersApi = {
  /**
   * Customer / public order list (if your backend exposes it).
   */
  list(options = {}, requestOptions = {}) {
    return apiRequest(
      withQuery(ENDPOINT, buildListQuery(options)),
      requestOptions,
    );
  },

  /**
   * Admin paginated list with status + search.
   * Matches: GET /api/orders/admin/all?page=&limit=&status=&search=
   */
  adminList(options = {}, requestOptions = {}) {
    return apiRequest(
      withQuery(`${ADMIN}/all`, buildListQuery(options)),
      requestOptions,
    );
  },

  /**
   * Single order (admin or public — use the route your backend supports).
   */
  getById(id, requestOptions = {}) {
    return apiRequest(`${ENDPOINT}/${validateId(id)}`, requestOptions);
  },

  /**
   * Admin single order detail.
   * Matches: GET /api/orders/admin/:id
   */
  adminGetById(id, requestOptions = {}) {
    return apiRequest(`${ADMIN}/${validateId(id)}`, requestOptions);
  },

  /**
   * Minimal status update (no concurrency check).
   * Prefer adminUpdateStatus in admin UIs.
   */
  updateStatus(id, status, requestOptions = {}) {
    return apiRequest(`${ENDPOINT}/${validateId(id)}/status`, {
      method: "PATCH",
      body: { status: normalizeStatus(status) },
      ...requestOptions,
    });
  },

  /**
   * Admin status update with optimistic concurrency + optional fields.
   * Matches the Orders page:
   *   PATCH /api/orders/admin/:id/status
   *   body: { status, expectedStatus?, trackingNumber?, reason?, note? }
   *
   * Backend should return 409 when expectedStatus does not match current status.
   */
  adminUpdateStatus(id, payload = {}, requestOptions = {}) {
    const body = buildStatusBody(payload);

    return apiRequest(`${ADMIN}/${validateId(id)}/status`, {
      method: "PATCH",
      body,
      ...requestOptions,
    });
  },
};

export default ordersApi;
