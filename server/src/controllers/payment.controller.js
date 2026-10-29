// controllers/payment.controller.js
import * as paymentService from "../services/payment.service.js";
import { ApiError } from "../utils/apiError.util.js";

/**
 * POST /payments/initialize
 * Body: {
 *   order_id: number,
 *   amount?: number,          // optional sanity check only
 *   currency?: string,
 *   customer: {
 *     email: string,
 *     first_name: string,
 *     last_name: string,
 *     phone_number: string
 *   },
 *   callback_url?: string,
 *   return_url?: string
 * }
 *
 * Usually called from the Order service after the order is created
 * and stock has been reserved.
 */
export const initialize = async (req, res, next) => {
  try {
    const { order_id, amount, currency, customer, callback_url, return_url } =
      req.body;

    // Basic required fields
    if (!order_id) {
      throw new ApiError(400, "order_id is required");
    }
    if (!customer || typeof customer !== "object") {
      throw new ApiError(400, "customer object is required");
    }
    if (!customer.email || !customer.first_name || !customer.last_name) {
      throw new ApiError(
        400,
        "customer.email, customer.first_name and customer.last_name are required",
      );
    }

    // Optional but recommended
    if (
      customer.phone_number &&
      !/^\+?[0-9]{9,15}$/.test(customer.phone_number)
    ) {
      throw new ApiError(400, "Invalid phone_number format");
    }

    const result = await paymentService.startPayment({
      order_id: Number(order_id),
      amount: amount != null ? Number(amount) : undefined,
      currency,
      customer: {
        email: String(customer.email).trim().toLowerCase(),
        first_name: String(customer.first_name).trim(),
        last_name: String(customer.last_name).trim(),
        phone_number: customer.phone_number
          ? String(customer.phone_number).trim()
          : undefined,
      },
      callback_url,
      return_url,
    });

    res.status(201).json({
      success: true,
      data: {
        payment_id: result.payment_id,
        tx_ref: result.tx_ref,
        checkout_url: result.checkout_url,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /webhooks/chapa
 *
 * CRITICAL: this route MUST receive the RAW body.
 * Mount it with:
 *   app.post("/webhooks/chapa", express.raw({ type: "application/json" }), chapaWebhook)
 * BEFORE any global express.json() middleware.
 */
export const chapaWebhook = async (req, res) => {
  try {
    // req.body is a Buffer because of express.raw()
    const result = await paymentService.handleWebhook(req.body, req.headers);

    // Always return 200 so Chapa does not keep retrying
    return res.status(200).json({
      received: true,
      handled: result.handled,
      reason: result.reason,
    });
  } catch (err) {
    // Log everything for investigation
    console.error("[webhook/chapa]", {
      message: err.message,
      statusCode: err.statusCode || 500,
      // do NOT log the raw body or headers that may contain secrets
    });

    // Still return 200.
    // Returning 4xx/5xx makes Chapa retry, which is rarely useful
    // for signature failures or malformed payloads.
    return res.status(200).json({
      received: true,
      error: "processing_failed",
    });
  }
};

/**
 * GET /payments/status/:tx_ref
 * Used by the frontend after the user returns from Chapa checkout.
 *
 * Ownership is enforced when the user is authenticated.
 */
export const getStatus = async (req, res, next) => {
  try {
    const { tx_ref } = req.params;

    if (!tx_ref || typeof tx_ref !== "string") {
      throw new ApiError(400, "tx_ref is required");
    }

    // req.user is set by your auth middleware (or null for public)
    const userId = req.user?.id ?? null;

    const payment = await paymentService.getPaymentStatus(tx_ref, {
      userId,
    });

    // Return only what the frontend needs
    res.json({
      success: true,
      data: {
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        tx_ref: payment.tx_ref,
        paid_at: payment.paid_at ?? null,
        // never expose gateway_response or internal failure reasons to customers
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/payments
 * Query: ?status=pending|completed|failed|needs_review|...&limit=20&offset=0
 */
export const adminList = async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;

    const data = await paymentService.listPayments({
      status: status || undefined,
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};
