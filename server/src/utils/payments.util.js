// utils/payments.util.js
import crypto from "crypto";
import { ApiError } from "./apiError.util.js";

export const PAYMENT_GATEWAY = "chapa";
export const DEFAULT_CURRENCY = "ETB";

const REQUEST_TIMEOUT_MS =
  Number(process.env.PAYMENT_REQUEST_TIMEOUT_MS) || 10_000;

// ---------- config (read at call time) ----------

const secretKey = () => {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) {
    console.error("[payment] CHAPA_SECRET_KEY is missing");
    throw new ApiError(500, "Payment service is not configured");
  }
  return key;
};

const webhookSecret = () => process.env.CHAPA_WEBHOOK_SECRET || secretKey();

const baseUrl = () =>
  (process.env.CHAPA_BASE_URL || "https://api.chapa.co/v1").replace(/\/$/, "");

// ---------- helpers ----------

/**
 * Generate a unique tx_ref before calling the gateway.
 * Format: shop-<24 hex chars>  → 29 characters total.
 * Confirm current Chapa max length if you change this.
 */
export const generateTxRef = () =>
  `shop-${crypto.randomBytes(12).toString("hex")}`;

const hmacSha256 = (data, secret) =>
  crypto.createHmac("sha256", secret).update(data).digest("hex");

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Single place for every HTTP call to Chapa.
 * - Timeout
 * - JSON parsing
 * - Never logs secrets or full headers
 */
const request = async (path, { method = "GET", body } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error("[payment] gateway request failed:", error.name);
    throw new ApiError(
      502,
      "Payment service is not reachable, please try again",
    );
  } finally {
    clearTimeout(timer);
  }
};

// ---------- public API ----------

/**
 * Starts a payment. Returns { checkout_url }.
 * customer: { email, first_name, last_name, phone_number }
 */
export const initializePayment = async ({
  tx_ref,
  amount,
  currency = DEFAULT_CURRENCY,
  customer,
  callback_url,
  return_url,
}) => {
  const { ok, status, data } = await request("/transaction/initialize", {
    method: "POST",
    body: {
      amount: String(amount),
      currency,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone_number: customer.phone_number,
      tx_ref,
      callback_url,
      return_url,
    },
  });

  const checkout_url = data?.data?.checkout_url;

  if (!ok || data?.status !== "success" || !checkout_url) {
    console.error("[payment] Chapa initialize failed:", status, data?.message);
    throw new ApiError(502, "Could not start the payment, please try again");
  }

  return { checkout_url };
};

/**
 * Asks the gateway for the real state of a payment.
 * Returns a normalised result so the service never sees gateway-specific words:
 *   { status: "success" | "failed" | "pending" | "not_found",
 *     amount, currency, transaction_id, tx_ref, raw }
 */
export const verifyTransaction = async (tx_ref) => {
  const { ok, status, data } = await request(
    `/transaction/verify/${encodeURIComponent(tx_ref)}`,
  );

  // Gateway does not know this reference
  if (status === 404) {
    return { status: "not_found", tx_ref, raw: data };
  }

  if (!ok || !data?.data) {
    console.error("[payment] Chapa verify failed:", status, data?.message);
    throw new ApiError(502, "Could not verify the payment, please try again");
  }

  const info = data.data;
  const gatewayStatus = String(info.status || "").toLowerCase();

  let normalised = "failed";
  if (gatewayStatus === "success") normalised = "success";
  else if (gatewayStatus === "pending") normalised = "pending";

  return {
    status: normalised,
    amount: Number(info.amount),
    currency: info.currency,
    transaction_id: info.reference ?? null,
    tx_ref: info.tx_ref ?? tx_ref,
    raw: data,
  };
};

/**
 * Verifies that a webhook really comes from Chapa.
 *
 * rawBody MUST be the exact bytes received (Buffer or string).
 * Never pass a re-stringified object.
 *
 * Headers: req.headers (Node lower-cases them).
 */
export const verifyWebhookSignature = (rawBody, headers) => {
  if (!rawBody) return false;

  const secret = webhookSecret();
  const payloadSignature = headers["x-chapa-signature"];
  const secretSignature = headers["chapa-signature"];

  if (!payloadSignature && !secretSignature) return false;

  // x-chapa-signature → HMAC of the event payload
  if (
    payloadSignature &&
    safeEqual(payloadSignature, hmacSha256(rawBody, secret))
  ) {
    return true;
  }

  // chapa-signature → HMAC of the secret itself
  if (
    secretSignature &&
    safeEqual(secretSignature, hmacSha256(secret, secret))
  ) {
    return true;
  }

  return false;
};
