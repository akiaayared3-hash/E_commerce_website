import * as paymentService from "../services/payment.service.js";
import { ApiError } from "../utils/apiError.util.js";

/**
 * POST /payments/initialize
 * Body: { order_id, amount, customer, callback_url, return_url }
 * (Usually called from the Order service after the order is created)
 */
export const initialize = async (req, res, next) => {
  try {
    const { order_id, amount, currency, customer, callback_url, return_url } =
      req.body;

    if (!order_id || !amount || !customer) {
      throw new ApiError(400, "order_id, amount and customer are required");
    }

    const result = await paymentService.startPayment({
      order_id,
      amount,
      currency,
      customer,
      callback_url,
      return_url,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /webhooks/chapa
 * IMPORTANT: this route must receive the RAW body
 */
export const chapaWebhook = async (req, res, next) => {
  try {
    // req.body is still a Buffer because of express.raw()
    const result = await paymentService.handleWebhook(req.body, req.headers);

    // Always return 200 so Chapa stops retrying
    res.status(200).json({ received: true, ...result });
  } catch (err) {
    // Still return 200 for signature errors if you want to avoid retries,
    // or 401 if you prefer Chapa to retry.
    // Most teams return 200 even on bad signature after logging.
    console.error("Webhook error:", err.message);
    res.status(200).json({ received: true, error: err.message });
  }
};

/**
 * GET /payments/status/:tx_ref
 * Used by frontend after the user returns from Chapa
 */
export const getStatus = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentStatus(req.params.tx_ref);

    res.json({
      success: true,
      data: {
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paid_at: payment.paid_at,
        tx_ref: payment.tx_ref,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/payments
 */
export const adminList = async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const data = await paymentService.listPayments({
      status,
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
